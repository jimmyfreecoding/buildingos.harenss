import { defineAsyncComponent } from 'vue';

/** 重点监控区域。props 里的字段都可以被改，propsSchema 是 AI 和搭建页的校验依据。 */
export default {
  type: 'monitor',
  name: '重点监控区域',
  group: '安防',
  icon: 'camera',
  component: defineAsyncComponent(() => import('./MonitorCard.vue')),
  data: { points: { slot: 'monitor.points' } },
  props: {"title":"重点监控区域","eyebrow":"MONITORING"},
  propsSchema: {
    title: { type: 'string', maxLength: 24 },
    eyebrow: { type: 'string', maxLength: 16 },
  },
  requires: [],
};
