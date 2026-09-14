import { defineAsyncComponent } from 'vue';

/** 今日能耗统计。props 里的字段都可以被改，propsSchema 是 AI 和搭建页的校验依据。 */
export default {
  type: 'energy',
  name: '今日能耗统计',
  group: '运营',
  icon: 'energy',
  component: defineAsyncComponent(() => import('./EnergyCard.vue')),
  data: { energy: { slot: 'energy.today' } },
  props: {"title":"今日能耗统计","eyebrow":"ENERGY"},
  propsSchema: {
    title: { type: 'string', maxLength: 24 },
    eyebrow: { type: 'string', maxLength: 16 },
  },
  requires: [],
};
