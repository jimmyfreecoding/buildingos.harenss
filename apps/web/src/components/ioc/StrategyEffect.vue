<template>
  <div class="strategy">
    <header class="strategy-head">
      <b>{{ title }}</b>
      <span v-if="subtitle">{{ subtitle }}</span>
    </header>

    <div class="strategy-body">
      <!-- 左：我方已配置的策略 -->
      <section class="strategy-card strategy-mine">
        <b class="strategy-sec">我方已配置策略</b>
        <div class="strategy-totals">
          <div v-for="t in totals" :key="t.label"><b>{{ t.value }}</b><span>{{ t.label }}</span></div>
        </div>
        <div class="strategy-kinds">
          <div v-for="k in kinds" :key="k.label" :class="{ zero: !k.count }">
            <span>{{ k.label }}</span><b>{{ k.count }}</b>
          </div>
        </div>
        <ul class="strategy-list">
          <li v-for="r in rows" :key="r.name">
            <button class="strategy-row" :disabled="!r.detail" @click="r.detail && emit('detail', r.detail)">
              <i :style="{ background: r.color }"></i>
              <em>{{ r.name }}</em>
              <span>{{ r.kind }}</span>
              <b>{{ r.actions }} 条</b>
            </button>
          </li>
        </ul>
        <div class="strategy-actions">
          <button class="strategy-bench-btn" :class="{ 'is-on': benchOpen }" @click="benchOpen = !benchOpen">
            <Icon name="chart"/>{{ benchOpen ? '收起对标' : '对标其他空间' }}
          </button>
          <button class="strategy-link" @click="sceneOpen = true"><Icon name="ai"/>智能场景</button>
        </div>
      </section>

      <!-- 右：对标其他空间 -->
      <section v-if="benchOpen" class="strategy-card strategy-bench">
        <b class="strategy-sec">{{ benchTitle }}</b>
        <table class="strategy-table">
          <thead>
            <tr><th rowspan="2">类别</th><th v-for="s in sources" :key="s.key" :colspan="3">{{ s.label }}</th></tr>
            <tr><template v-for="s in sources" :key="s.key"><th>策略</th><th>规则</th><th>覆盖</th></template></tr>
          </thead>
          <tbody>
            <tr v-for="b in benchmark" :key="b.kind">
              <td class="kind">{{ b.kind }}</td>
              <template v-for="s in sources" :key="s.key">
                <td :class="s.cls">{{ b[s.key].sets }}</td><td :class="s.cls">{{ b[s.key].rules }}</td><td :class="s.cls">{{ b[s.key].spaces }}</td>
              </template>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td class="kind">合计</td>
              <template v-for="s in sources" :key="s.key">
                <td :class="s.cls">{{ sum[s.key].sets }}</td><td :class="s.cls">{{ sum[s.key].rules }}</td><td :class="s.cls">{{ sum[s.key].spaces }}</td>
              </template>
            </tr>
          </tfoot>
        </table>
        <p v-if="note" class="strategy-note">{{ note }}</p>
      </section>
    </div>

    <!-- 24 小时时间轴：拖动看不同时间点的照明与空调，也可以自动循环 -->
    <div class="strategy-time">
      <button class="strategy-play" :class="{ 'is-on': playing }" @click="playing = !playing"><i>{{ playing ? '❚❚' : '▶' }}</i>{{ playing ? '暂停' : '播放' }}</button>
      <b class="strategy-clock">{{ clock }}</b>
      <div class="strategy-slider">
        <input type="range" min="0" max="1439" step="5" :value="minute" aria-label="24 小时时间轴" @input="onSeek" />
        <div class="strategy-ticks"><span v-for="h in 24" :key="h" :style="{ left: ((h - 1) / 24 * 100) + '%' }">{{ h - 1 }}</span></div>
      </div>
      <div class="strategy-now">
        <span v-for="n in nowLabels" :key="n">{{ n }}</span>
        <em v-if="!nowLabels.length">此刻没有策略在执行</em>
      </div>
    </div>
  </div>

  <!-- 智能场景示意图：点「智能场景」打开 -->
  <Teleport to="body">
    <div v-if="sceneOpen" class="strategy-modal" @click.self="sceneOpen = false">
      <figure>
        <img :src="sceneImage" alt="传统点对点模式与多维空间智控策略对比" />
        <button class="strategy-modal-close" aria-label="关闭" @click="sceneOpen = false">×</button>
      </figure>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import Icon from '../../widgets/Icon.vue';

// 对标面板默认收起来，点左边卡片底部的按钮才展开
const benchOpen = ref(false);
// 「智能场景」按钮打开的那张图
const sceneOpen = ref(false);
const sceneImage = '/strategy/traditional-vs-multidim.png';
const emit = defineEmits(['detail', 'room-state']);



const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  benchTitle: { type: String, default: '对标其他空间策略' },
  note: { type: String, default: '' },
  totals: { type: Array, default: () => [] },
  kinds: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  benchmark: { type: Array, default: () => [] },
  // 对标表里的几方：我方 / 吉行园区 / 望潮
  sources: { type: Array, default: () => [] },
  // 24 小时时间轴用的排程
  schedule: { type: Array, default: () => [] },
});

/* ---------------------------------------------------------------- 24 小时时间轴 */
// schedule: [{ type:'air'|'light', ids:[房间 id], rules:[{ t:'08:30', on:true, temp:27 }] }]
const minute = ref(8 * 60);
// 一进页面就自动循环播放
const playing = ref(true);
const clock = computed(() => String(Math.floor(minute.value / 60)).padStart(2, '0') + ':' + String(minute.value % 60).padStart(2, '0'));
const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };

// 某一时刻：每条规则取「不晚于当前时间」的最后一条；一条都没有就沿用前一天的末条
function stateAt(min) {
  const out = {};
  for (const g of props.schedule || []) {
    const rs = g.rules || [];
    if (!rs.length) continue;
    let eff = rs[rs.length - 1];
    for (const r of rs) if (toMin(r.t) <= min) eff = r;
    for (const id of g.ids || []) {
      const s = out[id] || (out[id] = {});
      if (g.type === 'air') s.ac = { on: eff.on, temp: eff.temp };
      else s.light = eff.on;
    }
  }
  return out;
}
// 现在正在执行什么，写在时间轴右边
const nowLabels = computed(() => {
  const seen = new Set();
  for (const g of props.schedule || []) {
    const rs = g.rules || [];
    if (!rs.length) continue;
    let eff = rs[rs.length - 1];
    for (const r of rs) if (toMin(r.t) <= minute.value) eff = r;
    const tag = g.type === 'air' ? '空调' : '照明';
    seen.add(tag + ' · ' + (eff.on ? (eff.temp ? '开 ' + eff.temp + '℃' : '开') : '关') + ' · ' + (g.area || g.ids.length + ' 间'));
  }
  return [...seen];
});
function onSeek(e) { minute.value = Number(e.target.value); }
let timer = null;
watch(playing, on => {
  if (timer) { clearInterval(timer); timer = null; }
  if (on) timer = setInterval(() => { minute.value = (minute.value + 10) % 1440; }, 120);
}, { immediate: true });
onBeforeUnmount(() => { if (timer) clearInterval(timer); });
// 时间一变就把房间状态推给地图
watch([minute, () => props.schedule], () => emit('room-state', stateAt(minute.value)), { immediate: true, deep: true });


const sum = computed(() => {
  // 有一格不是数字（台账里没这项，写的「—」）就整列不合计，别把「—」加成 0
  const field = (rows, k) => (rows.some(r => typeof r[k] !== 'number') ? '—' : rows.reduce((n, r) => n + (r[k] || 0), 0));
  const out = {};
  for (const s of props.sources) {
    const rows = props.benchmark.map(b => b[s.key] || {});
    out[s.key] = { sets: field(rows, 'sets'), rules: field(rows, 'rules'), spaces: field(rows, 'spaces') };
  }
  return out;
});
</script>