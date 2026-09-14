import { ALL_TOOLS, runReadTool } from './tools.js';

/**
 * 自然语言 -> 配置改动。
 *
 * 两条路，产出的都是同一份「改动数组」，后面走同一套检查、预览、确认、撤销：
 * - remote：POST 到自己服务器的 /api/ai，由那边的模型调工具（API key 留在服务端）
 * - local：关键词规则。没有后端也能用，界面上会说明当前是规则模式
 */
const CARD_WORDS = [
  ['overview', ['大楼简介', '园区概况', '简介', '概览']],
  ['environment', ['办公环境', '环境质量', '温湿度', '空气质量', '环境']],
  ['monitor', ['监控', '摄像头', '摄像机', '视频巡查', '安防摄像']],
  ['alarm', ['报警', '告警', '事件']],
  ['people', ['人员统计', '人员', '人数']],
  ['parking', ['车辆', '停车', '车位']],
  ['traffic', ['人流', '通行', '客流', '趋势']],
  ['energy', ['能耗', '用电', '能源', '用水']],
];

const THEME_WORDS = [
  ['graphite-gold', ['石墨', '金色', '暗金', '暖色']],
  ['dark-cyan', ['深蓝', '深色', '冷色', '科技蓝', '蓝色']],
];

const SITE_WORDS = [['smart', ['smart']], ['jixing', ['吉行']]];
const LAYOUT_WORDS = [['three-column', ['三栏', '左右两栏', '经典']]];
const REGION_WORDS = { left: ['左栏', '左边', '左侧'], right: ['右栏', '右边', '右侧'] };
const REGION_LABEL = { left: '左栏', right: '右栏' };

/** 找出「左边…」到下一个区域词之间的那段话 */
function segmentFor(text, words, allWords) {
  let best = -1;
  let matched = '';
  for (const word of words) {
    const at = text.indexOf(word);
    if (at >= 0 && (best < 0 || at < best)) { best = at; matched = word; }
  }
  if (best < 0) return null;
  const start = best + matched.length;
  let end = text.length;
  for (const other of allWords) {
    const at = text.indexOf(other, start);
    if (at >= 0 && at < end) end = at;
  }
  return text.slice(start, end);
}

/**
 * 在这段话里找卡片类型。
 *
 * 长词优先占位，免得「能耗趋势」同时命中 energy 和 traffic —— 先认下「能耗」，
 * 覆盖到的「趋势」就不再算数。
 */
/** 紧跟在这些词后面的部分算同一张卡：说「能耗趋势」不该再命中「趋势」那张图 */
const TRAILING = ['趋势', '变化', '统计', '曲线', '动态'];

function matchCards(segment) {
  const claims = [];
  for (const [type, words] of CARD_WORDS) {
    for (const word of words) {
      let from = 0;
      for (;;) {
        const at = segment.indexOf(word, from);
        if (at < 0) break;
        let end = at + word.length;
        for (const suffix of TRAILING) {
          if (segment.startsWith(suffix, end)) { end += suffix.length; break; }
        }
        claims.push({ type, start: at, end, length: end - at });
        from = at + word.length;
      }
    }
  }
  claims.sort((a, b) => b.length - a.length || a.start - b.start);
  const taken = [];
  const picked = [];
  for (const claim of claims) {
    if (taken.some(span => claim.start < span.end && claim.end > span.start)) continue;
    taken.push(claim);
    picked.push(claim);
  }
  picked.sort((a, b) => a.start - b.start);
  const types = [];
  for (const claim of picked) if (!types.includes(claim.type)) types.push(claim.type);
  return types;
}

export function createOrchestrator({ registries, endpoint }) {
  const context = () => ({ registries, spec: lastSpec });

  function localOps(text, spec, viewIndex) {
    const ops = [];
    const lower = text.toLowerCase();
    for (const [id, words] of SITE_WORDS) {
      if (words.some(word => lower.includes(word)) && id !== spec.site) {
        ops.push({ op: 'replace', path: '/site', value: id });
      }
    }
    for (const [id, words] of THEME_WORDS) {
      if (words.some(word => text.includes(word)) && id !== spec.theme) {
        ops.push({ op: 'replace', path: '/theme', value: id });
      }
    }
    for (const [id, words] of LAYOUT_WORDS) {
      if (words.some(word => text.includes(word)) && id !== spec.layout) {
        ops.push({ op: 'replace', path: '/layout', value: id });
      }
    }
    const allRegionWords = Object.values(REGION_WORDS).flat();
    for (const [regionId, words] of Object.entries(REGION_WORDS)) {
      const segment = segmentFor(text, words, allRegionWords);
      if (segment === null) continue;
      const types = matchCards(segment);
      if (!types.length) continue;
      for (const type of types) {
        if (!(spec.cards && spec.cards[type])) {
          const def = registries.cards.get(type);
          ops.push({ op: 'add', path: '/cards/' + type, value: { type, props: { ...(def ? def.props : {}) } } });
        }
      }
      ops.push({ op: 'replace', path: '/views/' + viewIndex + '/regions/' + regionId, value: types });
    }
    return ops;
  }

  function localPropose(text, spec) {
    const views = spec.views || [];
    const viewIndex = Math.max(0, views.findIndex(view => view.id === (spec.navigation && spec.navigation.active)));
    const ops = localOps(text, spec, viewIndex);
    if (!ops.length) {
      return {
        ops: [],
        reply: '没听出要改什么。可以这样说：「左边放监控和告警，右边放能耗和人员，用深色主题，接 Smart 园区」。',
      };
    }
    const parts = ops.map(op => {
      if (op.path === '/site') return '园区换成 ' + op.value;
      if (op.path === '/theme') return '主题换成 ' + op.value;
      if (op.path === '/layout') return '布局换成 ' + op.value;
      if (op.path.indexOf('/regions/') > 0) {
        const region = op.path.split('/').pop();
        return REGION_LABEL[region] + '改成 ' + op.value.join('、');
      }
      return op.path;
    });
    return { ops, reply: '按关键词规则读懂：' + parts.join('；') + '。' };
  }

  async function remotePropose(text, spec) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: text }],
        tools: ALL_TOOLS,
        spec,
        context: {
          sites: runReadTool('list_sites', {}, context()),
          cards: runReadTool('list_cards', {}, context()),
          layouts: runReadTool('list_layouts', {}, context()),
          themes: runReadTool('list_themes', {}, context()),
        },
      }),
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    return { reply: data.reply || '模型给出了改动。', ops: Array.isArray(data.ops) ? data.ops : [] };
  }

  let lastSpec = null;

  return {
    endpoint,
    get mode() { return endpoint ? 'remote' : 'local'; },

    /** 读工具也能被界面直接调，方便把清单展示出来 */
    readTool(name, args) { return runReadTool(name, args || {}, context()); },

    /**
     * 把一句话变成改动数组。
     * 远端失败会自动退回规则模式，并把原因写进 warning。
     */
    async propose(text, spec) {
      lastSpec = spec;
      if (endpoint) {
        try {
          const result = await remotePropose(text, spec);
          return { ...result, source: 'remote' };
        } catch (error) {
          return { ...localPropose(text, spec), source: 'local', warning: '调用 AI 服务失败（' + error.message + '），已退回关键词规则。' };
        }
      }
      return { ...localPropose(text, spec), source: 'local' };
    },
  };
}
