import { defineAsyncComponent } from 'vue';

/** 今日人员统计。props 里的字段都可以被改，propsSchema 是 AI 和搭建页的校验依据。 */
export default {
  type: 'people',
  name: '今日人员统计',
  group: '运营',
  icon: 'users',
  component: defineAsyncComponent(() => import('./PeopleCard.vue')),
  data: { people: { slot: 'people.today' } },
  props: {"title":"今日人员统计","eyebrow":"PERSONNEL"},
  propsSchema: {
    title: { type: 'string', maxLength: 24 },
    eyebrow: { type: 'string', maxLength: 16 },
  },
  requires: [],
};
