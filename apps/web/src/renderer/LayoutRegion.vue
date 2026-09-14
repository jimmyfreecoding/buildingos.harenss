<template>
  <!-- 左右两栏：按顺序堆，位置由 CSS 定 -->
  <template v-if="!free">
    <CardHost
      v-for="instance in instances"
      :key="instance.id"
      :type="instance.type"
      :card-props="instance.props"
      @detail="payload => emit('detail', payload)"
      @open-monitor="(index, title) => emit('open-monitor', index, title)"
      @open-alarm="alarm => emit('open-alarm', alarm)"
    />
  </template>

  <!-- 自由画布：每张卡的位置和大小来自卡片实例上的 box -->
  <template v-else>
    <div
      v-for="(instance, position) in instances"
      :key="instance.id"
      class="free-box"
      :class="{ 'is-editing': editable }"
      :style="styleOf(instance.id, position)"
      @pointerdown="startDrag($event, instance.id, 'move')">
      <CardHost
        :type="instance.type"
        :card-props="instance.props"
        @detail="payload => emit('detail', payload)"
        @open-monitor="(index, title) => emit('open-monitor', index, title)"
        @open-alarm="alarm => emit('open-alarm', alarm)"
      />
      <template v-if="editable">
        <button class="free-remove" type="button" title="删掉这张卡" aria-label="删掉这张卡"
          @pointerdown.stop @click.stop="edit.remove(instance.id)">×</button>
        <span class="free-grip" title="拖这里改大小" aria-label="调整大小"
          @pointerdown.stop.prevent="startDrag($event, instance.id, 'resize')"></span>
      </template>
    </div>
  </template>
</template>

<script setup>
import { computed, nextTick, reactive } from 'vue';
import CardHost from './CardHost.vue';
import { useIocContext } from '../core/context.js';

const props = defineProps({
  regionId: { type: String, required: true },
  // 自由画布模式，见 layouts/free-canvas
  free: { type: Boolean, default: false },
  // 实例名 -> 额外的运行时 props（当前天气、快照、当前态势之类不是配置的状态）
  runtimeProps: { type: Object, default: () => ({}) },
});
const emit = defineEmits(['detail', 'open-monitor', 'open-alarm']);

const { spec, edit } = useIocContext();

// 当前态势 + 布局 -> 这个区域要放哪些卡、每张卡用什么参数
const instances = computed(() => {
  const current = spec.value;
  if (!current) return [];
  const views = current.views || [];
  const view = views.find(v => v.id === current.navigation.active) || views[0];
  const ids = (view && view.regions && view.regions[props.regionId]) || [];
  return ids.map(id => {
    const instance = (current.cards || {})[id] || { type: id, props: {} };
    // 运行时状态按实例名给。同一张卡加了第二份（building$2）就按类型兜底，
    // 免得「多放一张楼栋档案」那张永远空着。
    const runtime = props.runtimeProps[id] || props.runtimeProps[instance.type] || {};
    return {
      id,
      type: instance.type,
      props: { ...instance.props, ...runtime },
    };
  });
});

// 只有演示模式的编辑状态才拖得动
const editable = computed(() => props.free && Boolean(edit && edit.active));

// 拖动过程中的本地预览，松手后交给上层去存
const local = reactive({});
const MIN_W = 10;
const MIN_H = 8;
const round = value => Math.round(value * 10) / 10;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// 没写过 box 的卡（比如刚从三栏切过来）先按网格排，不至于叠在一起
function fallbackBox(index) {
  const column = index % 3;
  const row = Math.floor(index / 3);
  return { x: 3 + column * 32.5, y: 4 + row * 31, w: 29, h: 27 };
}
function boxOf(id, index) {
  return local[id]
    || (spec.value && spec.value.cards && spec.value.cards[id] && spec.value.cards[id].box)
    || fallbackBox(index);
}
function styleOf(id, index) {
  const box = boxOf(id, index);
  return { left: box.x + '%', top: box.y + '%', width: box.w + '%', height: box.h + '%' };
}

// 拖边框改位置，拖右下角改大小。用的是百分比，所以换分辨率不会散。
function startDrag(event, id, mode) {
  if (!editable.value) return;
  if (event.button !== undefined && event.button !== 0) return;
  const host = event.currentTarget && event.currentTarget.closest('.free-canvas');
  if (!host) return;
  event.preventDefault();
  const rect = host.getBoundingClientRect();
  const index = instances.value.findIndex(item => item.id === id);
  const from = { x: event.clientX, y: event.clientY, box: { ...boxOf(id, index) } };

  const move = e => {
    const dx = rect.width ? (e.clientX - from.x) / rect.width * 100 : 0;
    const dy = rect.height ? (e.clientY - from.y) / rect.height * 100 : 0;
    const box = from.box;
    local[id] = mode === 'move'
      ? { ...box, x: round(clamp(box.x + dx, 0, 100 - box.w)), y: round(clamp(box.y + dy, 0, 100 - box.h)) }
      : { ...box, w: round(clamp(box.w + dx, MIN_W, 100 - box.x)), h: round(clamp(box.h + dy, MIN_H, 100 - box.y)) };
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    const box = local[id];
    if (box && edit && typeof edit.move === 'function') edit.move(id, box);
    // 等上层存完、配置回灌下来再丢掉本地预览，中间不会闪
    nextTick(() => { delete local[id]; });
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}
</script>
