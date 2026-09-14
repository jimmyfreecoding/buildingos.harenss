import { defineAsyncComponent } from 'vue';

/**
 * 楼层平面图。
 *
 * 原来是 IocDashboard 里写死的浮层（.floor-plan-card）。做成卡片以后，
 * 演示模式的自由画布里可以给它一个很大的盒子，把平面图和点位铺开讲。
 *
 * 内容全部来自运行时状态（炸开的是哪一栋哪一层）和一份按种子生成的演示点位，
 * 所以 data 是空的。floating 属性让浮层和面板共用这一份实现。
 */
export default {
  type: 'plan',
  name: '楼层平面图',
  group: '园区概况',
  icon: 'floors',
  component: defineAsyncComponent(() => import('./PlanCard.vue')),
  data: {},
  props: { eyebrow: 'PLAN', empty: '在楼层面板里选一层，这里显示它的平面图和点位。' },
  propsSchema: {
    eyebrow: { type: 'string', maxLength: 16 },
    empty: { type: 'string', maxLength: 60 },
  },
  requires: [],
};
