/**
 * 吉行园区的六个态势。
 *
 * P4 之前，tab 是 IocDashboard.vue 里的常量，文案在数据槽 view.meta 里。
 * 这两样都是界面配置而不是业务数据，所以搬到园区文件里。
 *
 * regions 里写的是卡片实例名。目前六个态势放的卡片完全相同（和改造前一致）；
 * 以后想让某个态势放不同的卡，只改这里，不用动页面代码。
 */

const LEFT = ['overview', 'environment', 'monitor', 'alarm'];
const RIGHT = ['people', 'parking', 'traffic', 'energy'];
const regions = () => ({ left: LEFT.slice(), right: RIGHT.slice() });

export default [
  {
    id: 'overview',
    name: '综合态势',
    icon: 'grid',
    title: '园区综合运行态势',
    metrics: [],
    chart: { max: 150, unit: '人次', title: '今日人流动态', eyebrow: 'TRAFFIC', label: '今日各时段员工、供应商、访客人流' },
    regions: regions(),
  },
  {
    id: 'security',
    name: '安防态势',
    icon: 'shield',
    title: '园区安防态势',
    description: '视频巡查与告警联动，掌握园区安全运行状态。',
    metrics: [
      { label: '摄像机在线', value: '128' },
      { label: '今日告警', value: '3' },
      { label: '在线率', value: '99.2%' },
    ],
    chart: { max: 80, unit: '次', title: '今日安防事件趋势', eyebrow: 'ANALYTICS', label: '今日安防事件趋势' },
    regions: regions(),
  },
  {
    id: 'energy',
    name: '能耗态势',
    icon: 'energy',
    title: '园区能耗态势',
    description: '建筑分项用能监测，追踪园区节能表现。',
    metrics: [
      { label: '今日用电 / kWh', value: '6,284' },
      { label: '今日用水 / m³', value: '128' },
      { label: '同比节能', value: '8.6%' },
    ],
    chart: { max: 900, unit: 'kWh', title: '分楼栋用电趋势', eyebrow: 'ANALYTICS', label: '分楼栋用电趋势' },
    regions: regions(),
  },
  {
    id: 'traffic',
    name: '通行态势',
    icon: 'car',
    title: '园区通行态势',
    description: '人员与车辆通行分析，及时了解出入高峰。',
    metrics: [
      { label: '今日通行', value: '1,862' },
      { label: '在园车辆', value: '171' },
      { label: '通行效率', value: '98.6%' },
    ],
    chart: { title: '今日门禁通行趋势', eyebrow: 'ANALYTICS', label: '今日门禁通行趋势' },
    regions: regions(),
  },
  {
    id: 'devices',
    name: '设备态势',
    icon: 'device',
    title: '园区设备态势',
    description: '关键机电设备运行监测与日常维护管理。',
    metrics: [
      { label: '接入设备', value: '1,024' },
      { label: '在线设备', value: '1,018' },
      { label: '待维护', value: '6' },
    ],
    chart: { max: 100, unit: '%', title: '设备负荷变化', eyebrow: 'ANALYTICS', label: '设备负荷变化' },
    regions: regions(),
  },
  {
    id: 'space',
    name: '空间态势',
    icon: 'layers',
    title: '园区空间态势',
    description: '楼栋、会议室与办公空间使用情况总览。',
    metrics: [
      { label: '会议室', value: '31' },
      { label: '使用中', value: '18' },
      { label: '空间利用率', value: '78.4%' },
    ],
    chart: { max: 100, unit: '间 / 人', title: '今日会议室使用趋势', eyebrow: 'ANALYTICS', label: '今日会议室使用趋势' },
    regions: regions(),
  },
];
