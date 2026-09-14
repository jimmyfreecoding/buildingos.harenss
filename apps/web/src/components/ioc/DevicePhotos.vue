<template>
  <div class="dphoto">
    <header class="dphoto-head">
      <b>{{ title }}</b>
      <span v-if="subtitle">{{ subtitle }}</span>
    </header>

    <svg class="dphoto-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polyline v-for="g in placed" :key="g.name" :points="g.line" vector-effect="non-scaling-stroke" :style="{ stroke: g.color }" />
    </svg>
    <i v-for="g in placed" :key="g.name + '-dot'" class="dphoto-dot" :style="{ left: g.at[0] + '%', top: g.at[1] + '%', background: g.color }"></i>

    <div
      v-for="g in placed"
      :key="g.name"
      class="dphoto-card"
      :class="'is-' + g.side"
      :style="{ left: g.cx + '%', top: g.cy + '%', '--c': g.color }"
      role="button"
      tabindex="0"
      :aria-label="'放大查看 ' + g.name"
      @click="open = g"
      @keydown.enter.prevent="open = g"
      @keydown.space.prevent="open = g"
    >
      <span class="dphoto-pic"><img :src="g.image" :alt="g.name" loading="lazy"/></span>
      <div class="dphoto-text">
        <b>{{ g.name }}</b>
        <small v-if="g.where">{{ g.where }}</small>
      </div>
    </div>

    <!-- 点任意一张实拍图放大看 -->
    <Teleport to="body">
      <div v-if="open" class="dphoto-modal" @click.self="open = null">
        <figure :style="{ '--c': open.color }">
          <img :src="open.image" :alt="open.name" />
          <figcaption>
            <b>{{ open.name }}</b>
            <small v-if="open.where">{{ open.where }}</small>
          </figcaption>
          <button type="button" class="dphoto-modal-close" aria-label="关闭" @click="open = null">×</button>
        </figure>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  // [{ name, where, image, color, at: [x%, y%], side: 'left' | 'right' }]
  groups: { type: Array, default: () => [] },
});

const open = ref(null);

// 卡片分左右两列均分排，线从卡片贴边那条边出发，指到地图上的点
const placed = computed(() => {
  const build = (list, side, cx) => list.map((g, i) => {
    const cy = 20 + ((i + 0.5) * 62) / Math.max(1, list.length);
    return { ...g, side, cx, cy, line: cx + ',' + cy + ' ' + g.at[0] + ',' + g.at[1] };
  });
  const left = props.groups.filter(g => (g.side || 'left') === 'left');
  const right = props.groups.filter(g => g.side === 'right');
  return [...build(left, 'left', 17), ...build(right, 'right', 83)];
});
</script>