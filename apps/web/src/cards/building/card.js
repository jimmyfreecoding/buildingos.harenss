import { defineAsyncComponent } from 'vue';

/**
 * 楼栋档案。
 *
 * 原来是 IocDashboard 里写死的一块浮层（.building-card），点三维里的楼栋才出现。
 * 做成卡片以后，演示模式的自由画布里就能摆它、改大小、删掉。
 *
 * 内容全是运行时状态（当前选中的楼栋），不是业务数据也不是配置，所以 data 是空的。
 * floating 属性让同一个组件既能当浮层（大屏）又能当面板（自由画布），
 * 两种外壳一份实现。
 */
export default {
  type: 'building',
  name: '楼栋档案',
  group: '园区概况',
  icon: 'building',
  component: defineAsyncComponent(() => import('./BuildingCard.vue')),
  data: {},
  props: { eyebrow: 'ARCHIVE', empty: '点三维场景里的楼栋，这里显示它的建筑档案。' },
  propsSchema: {
    eyebrow: { type: 'string', maxLength: 16 },
    empty: { type: 'string', maxLength: 60 },
  },
  requires: [],
};
