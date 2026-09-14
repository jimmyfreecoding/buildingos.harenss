import { parsePointer } from '../core/spec/patch.js';

/** 允许改的路径前缀。别的一律打回，AI 碰不到配置以外的东西。 */
const ALLOWED_ROOTS = ['cards', 'views', 'theme', 'layout', 'site', 'navigation'];
const ALLOWED_OPS = ['add', 'remove', 'replace', 'move'];

function nameList(registry) {
  const ids = registry.ids();
  return ids.length ? ids.join(' / ') : '(清单为空)';
}

/**
 * 检查 AI 给出的改动。
 *
 * 只做「名字在不在清单里」「路径对不对」这类硬检查。任何一条不合法就整批打回，
 * 并把可用的选项写进 errors，让 AI 能自己改一版重来，而不是瞎猜。
 */
export function sanitizeOps(ops, { registries, spec }) {
  const errors = [];
  if (!Array.isArray(ops) || !ops.length) {
    return { ok: false, ops: [], errors: ['改动必须是一个非空数组'] };
  }

  const layout = registries.layouts.get(spec.layout);
  const regionIds = layout ? layout.regions.map(region => region.id) : [];

  // 这一批里新增的卡片实例，后面引用它也要算合法
  const addedCards = new Set();
  for (const op of ops) {
    const segments = safePointer(op && op.path);
    if (segments && segments[0] === 'cards' && op.op === 'add' && segments[1]) addedCards.add(segments[1]);
  }

  const cleaned = [];
  ops.forEach((op, index) => {
    const where = '第 ' + (index + 1) + ' 条改动';
    if (!op || typeof op !== 'object') { errors.push(where + '不是一个对象'); return; }
    if (!ALLOWED_OPS.includes(op.op)) { errors.push(where + '的操作「' + op.op + '」不支持'); return; }

    const segments = safePointer(op.path);
    if (!segments) { errors.push(where + '的路径「' + op.path + '」不合法'); return; }
    if (!ALLOWED_ROOTS.includes(segments[0])) {
      errors.push(where + '想改「' + segments[0] + '」，只允许改：' + ALLOWED_ROOTS.join(' / '));
      return;
    }

    switch (segments[0]) {
      case 'site':
        if (op.op !== 'remove' && !registries.sites.has(op.value)) {
          errors.push(where + '里的园区「' + op.value + '」不存在，可用：' + nameList(registries.sites));
          return;
        }
        break;
      case 'theme':
        if (op.op !== 'remove' && !registries.themes.has(op.value)) {
          errors.push(where + '里的主题「' + op.value + '」不存在，可用：' + nameList(registries.themes));
          return;
        }
        break;
      case 'layout':
        if (op.op !== 'remove' && !registries.layouts.has(op.value)) {
          errors.push(where + '里的布局「' + op.value + '」不存在，可用：' + nameList(registries.layouts));
          return;
        }
        break;
      case 'cards': {
        if (!segments[1]) { errors.push(where + '没有说明是哪张卡片'); return; }
        const instance = op.value;
        if (op.op !== 'remove') {
          if (!instance || typeof instance !== 'object' || !instance.type) {
            errors.push(where + '没有给出卡片的 type');
            return;
          }
          if (!registries.cards.has(instance.type)) {
            errors.push(where + '里的卡片类型「' + instance.type + '」不存在，可用：' + nameList(registries.cards));
            return;
          }
        }
        break;
      }
      case 'views': {
        const viewIndex = Number(segments[1]);
        const views = spec.views || [];
        if (!Number.isInteger(viewIndex) || viewIndex < 0 || viewIndex >= views.length) {
          errors.push(where + '指向的态势序号「' + segments[1] + '」不存在，当前有 ' + views.length + ' 个态势');
          return;
        }
        if (segments[2] === 'regions') {
          const regionId = segments[3];
          if (!regionIds.includes(regionId)) {
            errors.push(where + '里的区域「' + regionId + '」不在布局里，布局的区域是：' + regionIds.join(' / '));
            return;
          }
          if (op.op !== 'remove') {
            if (!Array.isArray(op.value)) { errors.push(where + '的 value 应该是卡片实例名数组'); return; }
            const unknown = op.value.filter(id => !(spec.cards && spec.cards[id]) && !addedCards.has(id));
            if (unknown.length) {
              errors.push(where + '引用了没定义的卡片实例「' + unknown.join('、') + '」，本批新增的卡片实例：' + ([...addedCards].join('、') || '无'));
              return;
            }
          }
        }
        break;
      }
      default:
        break;
    }
    cleaned.push(op);
  });

  if (!cleaned.length && !errors.length) errors.push('没有可执行的改动');
  return { ok: errors.length === 0, ops: cleaned, errors };
}

function safePointer(path) {
  try {
    return parsePointer(path);
  } catch (error) {
    return null;
  }
}
