import { defineAsyncComponent } from 'vue';

/**
 * 战略地图。
 *
 * 借用了 buildingos.slides 里 strategic-map 布局的分层结构（愿景 / 目标 / 触点 /
 * 场景应用 / 能力层 / 设备层），但拆成了「块」：一张卡可以只画其中几块，
 * 于是一页可以放好几个实例，把它们围在中间的建筑模型四周，而不是盖住它。
 *
 * blocks 里每一块的形状：
 *   { kind: 'band',    label, text }                    一条大字横幅
 *   { kind: 'chips',   label, items: [字符串] }          一排小方块
 *   { kind: 'columns', label, items: [{title, items}] }  若干列，每列标题 + 条目
 *   { kind: 'grid',    label, columns, items: [{title, desc}] }  网格，每格标题 + 说明
 *   { kind: 'list',    label, items: [字符串] }          竖排
 *
 * theme 只认 green / blue / orange / purple 四个（和参考里一致），默认 green。
 * 这张卡是示意图，自带一套色，不跟界面主题走。
 */
export default {
  type: 'strategy-map',
  name: '战略地图',
  group: '园区概况',
  icon: 'layers',
  component: defineAsyncComponent(() => import('./StrategyMapCard.vue')),
  // 内容来自配置，不取数据槽
  data: {},
  props: {
    theme: 'orange',
    title: '战略地图',
    eyebrow: 'STRATEGY',
    blocks: [],
  },
  propsSchema: {
    theme: { type: 'string', maxLength: 12 },
    title: { type: 'string', maxLength: 20 },
    eyebrow: { type: 'string', maxLength: 20 },
    blocks: { type: 'array' },
  },
  requires: [],
};
