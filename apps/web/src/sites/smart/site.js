import { SMART_BUILDINGS } from '../../scene/createSmartCampus.js';
import mock from './data/mock.js';
import views from './views.js';

/**
 * Smart 园区。原来这些信息散在 campusModels.js 和 UI 里的 modelId 判断里。
 */
export default {
  id: 'smart',
  name: 'Smart 园区',
  english: 'SMART PARK',
  description: '参考照片制作的三层总部、两层造型中心与停车区（白色厂房为背景）。尺寸、层数及业务数据为概念演示。',
  buildings: SMART_BUILDINGS,

  defaultScene: 'smart-webgl',
  defaultDataSource: 'demo-mock',
  defaultLayout: 'three-column',
  defaultTheme: 'dark-cyan',
  defaultView: 'overview',

  // 按 SMART 上报口径：规划建筑面积 35,117㎡ = 地上 27,333 + 地下 7,784
  area: { total: '35,117', suffix: '' },

  // 只有总部 A 座 1F 建了室内模型，所以楼层面板里只能选 A 座 1F
  modeledFloors: { A: [1] },

  // 炸开 A 座 1F 时，用室内视图覆盖层，而不是通用平面图卡片
  overlays: [
    { provider: 'smart-indoor', trigger: { building: 'A', floor: 1 } },
  ],

  floorPickerHint: '总部 · 已建模 1F',

  // 六个态势（内容目前和吉行相同，见 views.js 顶部说明）
  views,

  // 演示数据（内容目前和吉行相同，见 data/mock.js 顶部说明）
  data: mock,
};
