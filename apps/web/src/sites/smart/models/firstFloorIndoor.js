import { defineAsyncComponent } from 'vue';

/**
 * Smart 总部 A 座 1F 的室内视图。
 *
 * 它不是一个 DOM 工厂，而是一个 Vue 组件，所以用 component 字段而不是 create()。
 * 什么时候显示由园区文件里的 overlays[].trigger 决定。
 */
export default {
  id: 'smart-indoor',
  label: 'Smart 总部 1F 室内视图',
  kind: 'indoor',
  capabilities: ['roomHighlight', 'planView'],
  component: defineAsyncComponent(() => import('../../../components/ioc/SmartFirstFloor.vue')),
};
