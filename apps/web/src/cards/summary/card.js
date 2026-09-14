import { defineAsyncComponent } from 'vue';

/**
 * 专题视图。
 *
 * 内容就是当前态势的标题、说明和三个指标 —— 这些写在态势里（sites/<id>/views.js，
 * 演示模式每一页也可以在 overrides.views 里改），所以这张卡渲染的是**配置**，
 * 不是业务数据，data 是空的。
 *
 * 它原来是 IocDashboard 里写死的一块浮层（.domain-card），跟着 currentView.metrics
 * 自动出现 —— 那样它既不属于任何区域，也进不了自由画布，既拖不动也删不掉。
 * 做成卡片以后就和别的卡一视同仁了。
 */
export default {
  type: 'summary',
  name: '专题视图',
  group: '园区概况',
  icon: 'layers',
  component: defineAsyncComponent(() => import('./SummaryCard.vue')),
  // 只读配置，不取数据槽
  data: {},
  props: {
    eyebrow: '专题视图',
    detailLabel: '查看专题详情',
  },
  propsSchema: {
    eyebrow: { type: 'string', maxLength: 16 },
    detailLabel: { type: 'string', maxLength: 16 },
  },
  requires: [],
};
