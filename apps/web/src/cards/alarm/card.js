import { defineAsyncComponent } from 'vue';

/** 视频报警信息。props 里的字段都可以被改，propsSchema 是 AI 和搭建页的校验依据。 */
export default {
  type: 'alarm',
  name: '视频报警信息',
  group: '安防',
  icon: 'bell',
  component: defineAsyncComponent(() => import('./AlarmCard.vue')),
  data: { alarms: { slot: 'alarm.list' } },
  props: {"title":"视频报警信息","eyebrow":"ALERTS"},
  propsSchema: {
    title: { type: 'string', maxLength: 24 },
    eyebrow: { type: 'string', maxLength: 16 },
  },
  requires: [],
};
