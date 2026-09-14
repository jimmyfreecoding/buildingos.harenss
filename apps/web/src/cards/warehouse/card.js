import { defineAsyncComponent } from 'vue';
export default {
  type: 'warehouse', name: '仓库模型信息', group: '园区概况', icon: 'building',
  component: defineAsyncComponent(() => import('./WarehouseCard.vue')),
  data: {}, props: { panel: 'facts' }, propsSchema: { panel: { type: 'string', enum: ['facts', 'controls'] } }, requires: [],
};
