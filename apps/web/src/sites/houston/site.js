import { HOUSTON, BUILDINGS, MODES } from './modelConfig.js';
export default {
  id: 'houston', name: '休斯敦仓库', english: 'HOUSTON · BUILDING 6', location: 'HOUSTON · TEXAS',
  description: '依据 CAD 与现场照片重建 Building 6。主体 728′ × 420′，A/B/C/D 货架分区按图定位；高度、货架细节及场景车辆为推定或示意，非竣工 BIM。',
  buildings: BUILDINGS, defaultScene: 'houston-webgl', defaultDataSource: 'demo-mock',
  defaultLayout: 'three-column', defaultTheme: 'light-orange', defaultView: 'overview',
  area: { total: HOUSTON.areaM2.toLocaleString('en-US'), suffix: '' }, modeledFloors: {}, overlays: [],
  cards: {
    'warehouse-info': { type: 'warehouse', props: { panel: 'facts' } },
    'warehouse-controls': { type: 'warehouse', props: { panel: 'controls' } },
  },
  views: MODES.map(m => ({ ...m, sceneMode: m.id, metrics: [], regions: { left: ['warehouse-info'], right: ['warehouse-controls'] } })),
  data: { 'alarm.list': [], 'detail.tables': {} },
};
