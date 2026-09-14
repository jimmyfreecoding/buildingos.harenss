<template>
  <section v-if="!definition" class="ioc-panel"><div class="panel-body card-fallback">没有登记卡片「{{ type }}」</div></section>
  <section v-else-if="failed" class="ioc-panel"><div class="panel-body card-fallback">卡片「{{ definition.name }}」渲染出错，已单独兜住，不影响别的面板。</div></section>
  <component v-else :is="definition.component" v-bind="mergedProps" />
</template>

<script setup>
import { computed, onErrorCaptured, ref } from 'vue';
import { registries } from '../registries/index.js';

const props = defineProps({
  // 卡片类型，对应 cards/<type>/card.js 里的 type
  type: { type: String, required: true },
  // 覆盖卡片默认 props 的字段
  cardProps: { type: Object, default: () => ({}) },
});

const failed = ref(false);
onErrorCaptured(error => {
  console.error('[卡片 ' + props.type + '] 渲染出错：', error);
  failed.value = true;
  // 返回 false 表示不再往上抛：一张卡坏了不影响整个大屏
  return false;
});

const definition = computed(() => registries.cards.get(props.type) || null);
const mergedProps = computed(() => ({
  ...(definition.value ? definition.value.props : {}),
  ...props.cardProps,
}));
</script>
