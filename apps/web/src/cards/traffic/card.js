import { defineAsyncComponent } from 'vue';

/** 人流与趋势。props 里的字段都可以被改，propsSchema 是 AI 和搭建页的校验依据。 */
export default {
  type: 'traffic',
  name: '人流与趋势',
  group: '运营',
  icon: 'chart',
  component: defineAsyncComponent(() => import('./TrafficCard.vue')),
  data: { series: { slot: 'traffic.flow', params: { view: '当前态势' } } },
  props: {"title":"今日人流动态","eyebrow":"TRAFFIC"},
  propsSchema: {
    title: { type: 'string', maxLength: 24 },
    eyebrow: { type: 'string', maxLength: 16 },
  },
  requires: [],
};
