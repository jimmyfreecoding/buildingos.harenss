import { defineAsyncComponent } from 'vue';

/**
 * Smart 总部 1F 的平面背景。
 *
 * 和 smart-indoor 的区别：那个是嵌在大屏里的室内视图（深色、带筛选和详情面板），
 * 这个是给演示页面当背景用的白底平面 —— 没有外壳，只留平面和房间名。
 * 机位可以从外面传进来，也可以读出去，演示模式靠它「保存视角」。
 */
export default {
  id: 'smart-floor-bg',
  label: 'Smart 总部 1F · 白底平面背景',
  kind: 'indoor',
  capabilities: [],
  component: defineAsyncComponent(() => import('../../components/ioc/FloorBackdrop.vue')),
};
