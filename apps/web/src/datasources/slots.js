/**
 * 数据槽。
 *
 * 这是卡片和数据源之间唯一的约定：卡片说「我要 kpi.overview」，至于这个值
 * 是写死的演示数据、REST 接口还是 MQTT 推来的，由数据源决定。
 * 这里只登记槽的名字和形状，不写实现。
 */
export const DATA_SLOTS = {
  'kpi.overview': '大楼简介：运行状态、运行天数、空间指标（会议室 / 门禁 / 配套 / 车位 / 电梯 / 工位）',
  'env.quality': '办公环境质量：等级、温度、湿度（按天气取）、CO2',
  'monitor.points': '重点监控区域：{ online, total, points: [{ id, name, title }] }',
  'alarm.list': '视频报警事件：Alarm[]，每项 { id, location, description, time, level }',
  'people.today': '今日人员统计：{ total, groups: [{ key, label, value, percent, color }] }',
  'parking.today': '今日车辆统计：{ rate, enabled, free, used, reserved }',
  'traffic.flow': '趋势折线（按态势取）：Series[]，每项 { name, color, values }',
  'energy.today': '今日能耗：{ total, decimal, unit, saving, series }',
  'detail.tables': '详情弹窗的静态表格：{ [key]: [标题, 说明, 行数组] }',
};

export const SLOT_IDS = Object.keys(DATA_SLOTS);
