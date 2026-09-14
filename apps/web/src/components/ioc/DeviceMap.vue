<template>
  <div class="devmap">
    <header class="devmap-head">
      <b>{{ title }}</b>
      <span v-if="subtitle">{{ subtitle }}</span>
    </header>

    <!-- 引导线：卡片边缘出发，直线指到地图上的目标点 -->
    <svg class="devmap-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polyline v-for="g in placed" :key="g.name" :points="g.line" vector-effect="non-scaling-stroke" :style="{ stroke: g.color }" />
    </svg>
    <i v-for="g in placed" :key="g.name + '-dot'" class="devmap-dot" :style="{ left: g.at[0] + '%', top: g.at[1] + '%', background: g.color }"></i>

    <div
      v-for="g in placed"
      :key="g.name"
      class="devmap-card"
      :class="'is-' + g.side"
      :style="{ left: g.cx + '%', top: g.cy + '%', '--c': g.color }"
    >
      <span class="devmap-icon"><Icon :name="g.icon"/></span>
      <div class="devmap-text">
        <em>{{ g.name }}</em>
        <div><b>{{ g.count }}</b><small>台</small></div>
      </div>
    </div>

    <!-- 底部分类汇总：每个来源一行，每类一个 chip（图标 + 名称 + 台数） -->
    <div v-if="categories && categories.length" class="devmap-cats">
      <div v-for="group in categories" :key="group.title" class="devmap-cat-row">
        <b class="devmap-cat-title">{{ group.title }}</b>
        <div class="devmap-chips">
          <button
            v-for="item in group.items"
            :key="item.name"
            class="devmap-chip"
            :class="{ 'no-detail': !item.detail }"
            :disabled="!item.detail"
            :style="{ '--c': item.color || '#3d7ae0' }"
            @click="item.detail && emit('detail', item.detail)">
            <i><Icon :name="item.icon"/></i>
            <em>{{ item.name }}</em>
            <b>{{ item.count }}</b>
          </button>
        </div>
      </div>
    </div>

    <div v-if="total" class="devmap-total">
      <div><b>{{ total.value }}</b><small>{{ total.unit }}</small></div>
      <span>{{ total.label }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import Icon from '../../widgets/Icon.vue';

const emit = defineEmits(['detail']);

const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  total: { type: Object, default: null },
  // [{ title, items: [{ name, count, icon, color }] }]
  categories: { type: Array, default: () => [] },
  // [{ name, count, icon, color, at: [x%, y%], side: 'left' | 'right' }]
  groups: { type: Array, default: () => [] },
});

// 卡片按左右两列均分排，线的起点就是卡片贴边那条边
const placed = computed(() => {
  const build = (list, side, cx) => list.map((g, i) => {
    const cy = 18 + ((i + 0.5) * 66) / Math.max(1, list.length);
    return { ...g, side, cx, cy, line: cx + ',' + cy + ' ' + g.at[0] + ',' + g.at[1] };
  });
  const left = props.groups.filter(g => (g.side || 'left') === 'left');
  const right = props.groups.filter(g => g.side === 'right');
  return [...build(left, 'left', 15), ...build(right, 'right', 85)];
});
</script>