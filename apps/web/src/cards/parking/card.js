import { defineAsyncComponent } from 'vue';

/** 今日车辆统计。props 里的字段都可以被改，propsSchema 是 AI 和搭建页的校验依据。 */
export default {
  type: 'parking',
  name: '今日车辆统计',
  group: '运营',
  icon: 'car',
  component: defineAsyncComponent(() => import('./ParkingCard.vue')),
  data: { parking: { slot: 'parking.today' } },
  props: {"title":"今日车辆统计","eyebrow":"PARKING"},
  propsSchema: {
    title: { type: 'string', maxLength: 24 },
    eyebrow: { type: 'string', maxLength: 16 },
  },
  requires: [],
};
