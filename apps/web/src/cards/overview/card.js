import { defineAsyncComponent } from 'vue';

/** 大楼简介。props 里的字段都可以被改，propsSchema 是 AI 和搭建页的校验依据。 */
export default {
  type: 'overview',
  name: '大楼简介',
  group: '园区概况',
  icon: 'building',
  component: defineAsyncComponent(() => import('./OverviewCard.vue')),
  data: { kpi: { slot: 'kpi.overview' } },
  props: {"title":"大楼简介","eyebrow":"OVERVIEW"},
  propsSchema: {
    title: { type: 'string', maxLength: 24 },
    eyebrow: { type: 'string', maxLength: 16 },
  },
  requires: [],
};
