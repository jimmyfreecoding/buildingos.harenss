import { defineAsyncComponent } from 'vue';

/**
 * 系统架构图。
 *
 * 给一页「建设概况」用的：顶上是个总节点，下面一层是枢纽，再往下并排几组，
 * 每组一个标题加一串子系统。内容整段写在页面的配置里（不是数据槽），
 * 因为汇报图是这一页的内容，不是园区级的数据。
 *
 * groups 的形状：['{ title: '安防管理', items: ['视频监控系统', ...] }', ...]
 * propsSchema 里只校验「是个数组」—— 为了能校验把结构拍平不值得，形状由卡片自己兜。
 */
export default {
  type: 'topology',
  name: '系统架构图',
  group: '园区概况',
  icon: 'grid',
  component: defineAsyncComponent(() => import('./TopologyCard.vue')),
  // 内容来自配置，不取数据槽
  data: {},
  props: {
    root: 'IOC 智慧运营中心',
    hub: '数字孪生',
    groups: [],
    eyebrow: 'ARCHITECTURE',
  },
  propsSchema: {
    root: { type: 'string', maxLength: 24 },
    hub: { type: 'string', maxLength: 16 },
    eyebrow: { type: 'string', maxLength: 16 },
    groups: { type: 'array' },
  },
  requires: [],
};
