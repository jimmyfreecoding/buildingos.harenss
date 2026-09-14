import { BUILDINGS } from '../../scene/createCampus.js';
import mock from './data/mock.js';
import views from './views.js';

/**
 * 吉行园区。原来这些信息散在 campusModels.js、UI 里的 modelId 判断、
 * 以及 openDetails() 的文案字典里，现在集中到这一个文件。
 */
export default {
  id: 'jixing',
  name: '吉行园区',
  english: 'JIXING PARK',
  description: '三栋办公塔楼、商业裙楼与公共景观空间。',
  buildings: BUILDINGS,

  defaultScene: 'jixing-webgl',
  defaultDataSource: 'demo-mock',
  defaultLayout: 'three-column',
  defaultTheme: 'dark-cyan',
  defaultView: 'overview',

  // 总建筑面积的展示值（演示数据，后面接数据槽）
  area: { total: '154,992', suffix: '.74' },

  // 只声明「建了模、可以在楼层面板里选」的楼层。
  // 不写就是用楼栋自己的层数（吉行三栋都是 40 层）。
  modeledFloors: null,

  // 没有室内覆盖层：炸开楼层后显示的是通用平面图卡片
  overlays: [],

  floorPickerHint: '点击楼层拉近并炸开',

  // 六个态势（P4 从 tabs 常量和 view.meta 数据槽搬过来的）
  views,

  // 演示数据（P2 从 IocDashboard.vue 搬出来的）
  data: mock,
};
