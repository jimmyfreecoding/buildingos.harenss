<template>
  <div class="topo">
    <header class="topo-head">
      <b>{{ title }}</b>
      <div class="topo-legend">
        <span v-for="item in legend" :key="item.label"><i :style="{ background: item.color }"></i>{{ item.label }}</span>
      </div>
    </header>

    <div class="topo-cols" ref="colsEl">
      <!-- 走线：节点渲染完量出位置再画，配置在 links 里 -->
      <svg class="topo-links" aria-hidden="true">
        <path v-for="(d, i) in paths" :key="i" :d="d" />
      </svg>
      <section v-for="(col, ci) in columns" :key="col.no" class="topo-col">
        <b class="topo-col-head"><em>{{ col.no }}</em>{{ col.name }}</b>
        <div class="topo-body">
          <template v-for="(node, i) in col.nodes" :key="i">
            <div v-if="node.kind === 'group'" class="topo-group" :data-key="ci + '-' + i">
              <small>{{ node.title }}</small>
              <div v-for="item in node.items || []" :key="item.label" class="topo-item" :class="node.tone">
                <span><Icon :name="item.icon || 'grid'"/></span>{{ item.label }}
              </div>
              <i v-if="node.foot" class="topo-foot">{{ node.foot }}</i>
              <div v-for="item in node.items2 || []" :key="item.label" class="topo-item" :class="node.tone">
                <span><Icon :name="item.icon || 'grid'"/></span>{{ item.label }}
              </div>
            </div>

            <div v-else-if="node.kind === 'card'" class="topo-card" :class="'is-' + (node.tone || 'blue')" :data-key="ci + '-' + i">
              <div class="topo-card-top"><b>{{ node.name }}</b><em v-if="node.badge">{{ node.badge }}</em></div>
              <small v-if="node.desc">{{ node.desc }}</small>
              <div v-for="b in node.blocks || []" :key="b.title" class="topo-block">
                <b>{{ b.title }}</b><small>{{ b.sub }}</small>
              </div>
            </div>

            <i v-else-if="node.kind === 'chip'" class="topo-chip" :class="node.tone">{{ node.label }}</i>
            <i v-else-if="node.kind === 'arrow'" class="topo-arrow">→</i>

            <div v-else-if="node.kind === 'isolator'" class="topo-iso">
              <b>{{ node.left }}</b><i></i><b>{{ node.right }}</b>
              <span>{{ node.label }}</span>
            </div>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Icon from '../../widgets/Icon.vue';

const props = defineProps({
  title: { type: String, default: '' },
  legend: { type: Array, default: () => [] },
  columns: { type: Array, default: () => [] },
  // [[从哪个节点, 到哪个节点], ...]，节点用 '列序号-节点序号' 指
  links: { type: Array, default: () => [] },
});

// 量出每个节点的位置，按 links 画肘形走线（右 → 中点 → 下/上 → 左）
const colsEl = ref(null);
const paths = ref([]);
function measure() {
  const host = colsEl.value;
  if (!host) return;
  const base = host.getBoundingClientRect();
  const box = (key) => {
    const el = host.querySelector('[data-key="' + key + '"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { l: r.left - base.left, r: r.right - base.left, cy: (r.top + r.bottom) / 2 - base.top };
  };
  paths.value = (props.links || []).map(([from, to]) => {
    const a = box(from), b = box(to);
    if (!a || !b) return null;
    const midX = a.r + Math.max(10, (b.l - a.r) / 2);
    return 'M ' + a.r + ' ' + a.cy + ' H ' + midX + ' V ' + b.cy + ' H ' + b.l;
  }).filter(Boolean);
}
onMounted(() => { measure(); window.addEventListener('resize', measure); });
onBeforeUnmount(() => { window.removeEventListener('resize', measure); });
watch(() => props.columns, () => nextTick(measure), { deep: true });
</script>