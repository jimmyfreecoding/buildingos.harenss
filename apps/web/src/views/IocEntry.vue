<template>
  <!-- 入口：读 ioc.config.js 决定进来是运营大屏还是演示文稿 -->
  <IocSlides v-if="mode === 'deck'" :boot="boot" />
  <IocDashboard v-else :overrides="boot.baseOverrides" />
</template>

<script setup>
import { computed } from 'vue';
import { resolveBoot } from '../core/boot.js';
import IocDashboard from './IocDashboard.vue';
import IocSlides from './IocSlides.vue';

const props = defineProps({
  // 路由上写死了模式（/ioc/dashboard、/ioc/deck）就用路由的
  forceMode: { type: String, default: null },
});

const boot = resolveBoot();
const mode = computed(() => props.forceMode || boot.mode);
</script>
