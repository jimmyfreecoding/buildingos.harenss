/**
 * 吉行园区的演示数据。
 *
 * P2 之前这些值散在 IocDashboard.vue 的模板和脚本里，现在集中到这里，
 * 由 demo-mock 数据源按数据槽取。数值和改造前完全一致，一个字都没改。
 *
 * 说明：环形图的圆弧长度（stroke-dasharray）仍然写在模板里，它属于渲染细节
 * 而不是数据，等卡片化之后再考虑由百分比算出来。
 */

// 24 小时人流基准曲线，各态势的趋势线都由它派生
const FLOW = [12,7,6,5,8,24,58,118,70,78,69,94,79,61,84,47,12,7,5,4,3,4,3,2];

function series(name, color, derive) {
  return { name, color, values: FLOW.map(derive) };
}

export default {
  'kpi.overview': {
    status: '园区运行平稳',
    runningDays: '运行第 1,286 天',
    space: {
      meetingRooms: { value: '31', unit: '间' },
      doors: { value: '20', unit: '个' },
      amenities: { value: '13', unit: '处' },
      parking: { value: '1,124', unit: '个' },
      lifts: { value: '28', unit: '部' },
      workstations: { value: '1,680', unit: '个' },
    },
  },

  'env.quality': {
    grade: '优',
    temperature: { value: '26', decimal: '.6', unit: '°C' },
    humidity: { decimal: '.1', unit: '%', byWeather: { rain: '86', default: '63' } },
    co2: { value: '481', decimal: '.6', unit: 'ppm' },
  },

  'monitor.points': {
    online: 2,
    total: 2,
    points: [
      { id: 'south-gate', name: '园区南门', title: '园区南门 · 监控预览' },
      { id: 'plaza', name: '中央景观广场', title: '中央景观广场 · 监控预览' },
    ],
  },

  'alarm.list': [
    { id: 'EVT-20260909-117', location: 'A座 · 通道117', description: '人员徘徊 / 周界入侵', time: '16:52', level: '关注' },
    { id: 'EVT-20260909-118', location: 'A座 · 通道118', description: '通道占用 / 异常停留', time: '16:46', level: '关注' },
    { id: 'EVT-20260909-098', location: 'B3F · JK98', description: '消防通道物品占用', time: '16:07', level: '预警' },
  ],

  'people.today': {
    total: '309',
    groups: [
      { key: 'staff', label: '员工', value: '76', percent: '25%', color: '#a8d6ff' },
      { key: 'vendor', label: '供应商', value: '233', percent: '75%', color: '#ff947b' },
      { key: 'visitor', label: '访客', value: '0', percent: '0%', color: '#7ee7aa' },
    ],
  },

  'parking.today': { rate: '83.8', enabled: '1,054', free: '883', used: '171', reserved: '70' },

  // 按态势取曲线：params.view 是态势 id
  'traffic.flow': params => {
   const flows = {
    overview: [
      series('员工', '#b4d5ff', v => Math.round(v * 0.28)),
      series('供应商', '#fc9b84', v => v),
      series('访客', '#7de6aa', (v, i) => (i > 6 && i < 16 ? Math.round(v * 0.035) : 0)),
    ],
    security: [
      series('视频巡查', '#94d3ff', v => Math.round(v * 0.6)),
      series('告警事件', '#fc9b84', (v, i) => (i === 7 ? 2 : i === 15 ? 1 : 0)),
    ],
    energy: [
      series('A 座', '#94d3ff', v => v * 6),
      series('B 座', '#fc9b84', v => v * 4),
      series('C 座', '#7de6aa', v => v * 2),
    ],
    devices: [
      series('空调机组', '#94d3ff', v => Math.min(100, Math.round(v * 0.7 + 20))),
      series('照明设备', '#7de6aa', v => Math.round(v * 0.45 + 12)),
    ],
    space: [
      series('会议室', '#94d3ff', v => Math.round(v * 0.21)),
      series('公共空间', '#7de6aa', v => Math.round(v * 0.65)),
    ],
   };
   return flows[params.view] || flows.overview;
  },

  'energy.today': {
    total: '6,284',
    decimal: '.5',
    unit: 'kWh',
    saving: '8.6%',
    series: [{ name: '用电量', color: '#88e7b4', values: [246,230,198,184,178,188,197,260,395,580,682,738,750,721,684,623,702,731,595,430,375,315,282,247] }],
  },

  'detail.tables': {
    amenities: ['商业配套空间', '园区公共服务与商业配套资源。', [['餐饮与咖啡', '6 处', '营业中'], ['便利零售', '3 处', '营业中'], ['健身与生活服务', '4 处', '营业中']]],
    rooms: ['公共会议室', '会议室使用情况与可预约资源。', [['A 座会议室', '14 间', '9 间使用中'], ['B 座会议室', '12 间', '7 间使用中'], ['C 座会议室', '5 间', '2 间使用中']]],
    doors: ['智能门禁', '园区门禁点位与运行状态。', [['A 座门禁', '8 个', '全部在线'], ['B 座门禁', '8 个', '全部在线'], ['C 座门禁', '4 个', '全部在线']]],
    parking: ['园区停车统计', '总规划车位 1,124 个，其中 1,054 个已启用。', [['空闲车位', '883 个', '83.8%'], ['占用车位', '171 个', '16.2%'], ['预留及维护', '70 个', '未计入空闲率'], ['今日累计入场', '486 辆', '模拟统计']]],
    lifts: ['电梯运行状态', '共 28 部电梯接入园区运行管理。', [['A 座电梯', '12 部', '运行正常'], ['B 座电梯', '10 部', '运行正常'], ['C 座电梯', '6 部', '运行正常']]],
    work: ['办公工位统计', '园区办公资源与入驻情况。', [['总工位', '1,680 个', '规划容量'], ['已分配', '1,317 个', '78.4%'], ['可分配', '363 个', '21.6%']]],
    people: ['今日人员统计', '展示当前在园人员构成。', [['员工', '76 人', '25%'], ['供应商', '233 人', '75%'], ['访客', '0 人', '0%'], ['合计', '309 人', '模拟门禁数据']]],
    energy: ['园区能源统计', '今日累计能耗与楼栋分项数据。', [['A 座用电', '2,892.4 kWh', '46.0%'], ['B 座用电', '2,199.6 kWh', '35.0%'], ['C 座用电', '1,192.5 kWh', '19.0%'], ['节能率', '8.6%', '较昨日'], ['今日用水', '128 m³', '模拟数据']]],
  },
};
