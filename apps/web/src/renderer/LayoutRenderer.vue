<template>
  <template v-for="region in stackRegions" :key="region.id">
    <aside :class="['ioc-sidebar', region.side + '-sidebar']" :aria-label="region.label">
      <LayoutRegion
        :region-id="region.id"
        :runtime-props="runtimeProps"
        @detail="payload => emit('detail', payload)"
        @open-monitor="(index, title) => emit('open-monitor', index, title)"
        @open-alarm="alarm => emit('open-alarm', alarm)"
      />
    </aside>
  </template>

  <!-- 自由画布：卡片的位置和大小写在每张卡自己的 box 里 -->
  <aside
    v-for="region in freeRegions"
    :key="region.id"
    class="free-canvas"
    :aria-label="region.label">
    <LayoutRegion
      free
      :region-id="region.id"
      :runtime-props="runtimeProps"
      @detail="payload => emit('detail', payload)"
      @open-monitor="(index, title) => emit('open-monitor', index, title)"
      @open-alarm="alarm => emit('open-alarm', alarm)"
    />
  </aside>

  <slot />
</template>

<script setup>
import { computed } from 'vue';
import LayoutRegion from './LayoutRegion.vue';
import { useIocContext } from '../core/context.js';

// 这里不声明 root 元素：左右两栏和默认插槽是并列的兄弟节点，
// 这样插进页面里不会多出一层 DOM，原来的 CSS 一点不受影响。
defineProps({ runtimeProps: { type: Object, default: () => ({}) } });
const emit = defineEmits(['detail', 'open-monitor', 'open-alarm']);

const { spec, registries } = useIocContext();

// 布局里 role 是 stack 的区域就是左右两栏；free 是自由画布；
// stage / float 由页面自己管
const regions = computed(() => {
  const current = spec.value;
  const layout = registries.layouts.get(current && current.layout);
  return layout ? layout.regions : [];
});
const stackRegions = computed(() => regions.value.filter(region => region.role === 'stack'));
const freeRegions = computed(() => regions.value.filter(region => region.role === 'free'));
</script>
