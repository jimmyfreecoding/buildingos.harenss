import { defineAsyncComponent } from 'vue';

/** 办公环境质量。props 里的字段都可以被改，propsSchema 是 AI 和搭建页的校验依据。 */
export default {
  type: 'environment',
  name: '办公环境质量',
  group: '园区概况',
  icon: 'tree',
  component: defineAsyncComponent(() => import('./EnvironmentCard.vue')),
  data: { env: { slot: 'env.quality' } },
  props: {"title":"办公环境质量","eyebrow":"ENVIRONMENT"},
  propsSchema: {
    title: { type: 'string', maxLength: 24 },
    eyebrow: { type: 'string', maxLength: 16 },
  },
  requires: [],
};
