/**
 * 吉利集团智慧园区 · 演示文稿。
 *
 * 进来就是这一套：Smart 园区的三维模型 + 浅色主题 + 纯白背景，
 * 五个页面按汇报顺序排好，左右键翻页。
 *
 * 一页 = 一份 IOC 配置，两样东西按页走：
 *
 * 1. overrides.views —— 这一页那个态势的标题、说明、三个指标和左右两栏放哪些卡。
 *    屏幕上那张「专题视图」卡就跟着变，不用动园区文件。
 * 2. camera —— 这一页的三维机位。演示时直接拖模型，点翻页栏上的「保存视角」
 *    就存在本机；要固化下来就点「复制代码」，把片段粘到对应那一页里。
 *
 * camera.position 是相机在哪，camera.target 是看向哪。
 */

// 每页一份配置：name 是顶栏和翻页栏上的标题，其它见上面的说明
const page = ({ id, name, view, left, right, title, description, metrics, camera, overlays }) => ({
  id,
  name,
  view,
  camera,
  overlays,
  overrides: {
    views: [{
      id: view,
      title,
      description,
      metrics,
      regions: { left, right },
    }],
  },
});

// 自由画布是整页的属性：六个态势的区域都得写出来，不能只写当前那个，
// 否则校验会说「布局里不存在的区域」。这一页六个态势看的是同一张图。
const ALL_VIEWS = ['overview', 'security', 'energy', 'traffic', 'devices', 'space'];
const canvasViews = (cards, patch) => ALL_VIEWS.map(id => ({
  id,
  regions: { canvas: cards },
  ...(patch && patch.id === id ? patch.view : {}),
}));

/**
 * 吉利集团统一智慧园区框架方案 —— 一页战略地图。
 *
 * 内容来自 buildingos.slides 的 strategic-map 布局，但那边是整页铺开的平层图，
 * 这里是四张 strategy-map 卡围在中间的建筑模型四周：上愿景、左能力、右集成、
 * 下场景和设备。中间留出的是模型，所以这一页既讲清楚了框架，又没丢掉孪生。
 *
 * 模型定位配合四周的卡片：正对园区、略微抬高，让楼在中间那格里站满。
 */
const frameworkPage = {
  id: 'systems',
  name: '吉利集团统一智慧园区框架方案',
  view: 'overview',
  camera: { position: [0, 165, 265], target: [0, 12, -22] },
  overrides: {
    layout: 'free-canvas',
    cards: {
      'strategy': {
        type: 'strategy-map',
        props: {
          theme: 'orange',
          title: '战略蓝图',
          eyebrow: '2026年6月',
          blocks: [
            { kind: 'band', label: '愿景', text: '构建吉利集团统一、可进化的智慧楼宇平台' },
            { kind: 'chips', label: '目标', items: ['标准化建设', '集约化运营', '高效化交付', '可持续进化'] },
            { kind: 'chips', label: '触点', items: ['集团 IOC', '运营 WEB', '员工企微', '访客手机', '中控平板', '电子门牌', '移动巡检PAD', '开放API'] },
          ],
        },
        box: { x: 1.5, y: 1, w: 97, h: 21 },
      },
      'capabilities': {
        type: 'strategy-map',
        props: {
          theme: 'orange',
          title: '能力层',
          eyebrow: 'CAPABILITY',
          blocks: [
            { kind: 'grid', label: '空间治理', columns: 2, items: [
              { title: '楼宇地图与空间模型', desc: '(项目全生命周期)' },
              { title: '设备孪生与运行画像', desc: '(设备全生命周期)' },
              { title: '统一通行与权限中心', desc: '(人车人脸权限)' },
              { title: '能耗计量与策略优化', desc: '(节能闭环)' },
              { title: '视频监控与 AI 感知', desc: '(运营与安防)' },
              { title: '告警与工单中心', desc: '(处置闭环)' },
              { title: '开放 API 与业务连接器', desc: '(集团生态接入)' },
              { title: '运维知识库与辅助决策', desc: '(AI自升级)' },
            ] },
          ],
        },
        box: { x: 1.5, y: 23, w: 19.5, h: 46.5 },
      },
      'integration': {
        type: 'strategy-map',
        props: {
          theme: 'orange',
          title: '数据与集成',
          eyebrow: 'DATA · INTEGRATION',
          blocks: [
            { kind: 'chips', label: '数据智能', items: ['楼宇数据', '时序数据', '业务数据', 'AI数据', '空间数据', '策略数据'] },
            { kind: 'chips', label: '业务集成', items: ['企业微信', '会议系统', '访客系统', '停车系统', '报修系统', '资产系统', '消息中心', 'BI报表','用户中心'] },
            { kind: 'chips', label: '物业集成', items: ['楼控', '照明', '空调', '电梯', '门禁', '消防', '能耗', '监控','新风'] },
          ],
        },
        box: { x: 79, y: 23, w: 19.5, h: 46.5 },
      },
      'scenarios': {
        type: 'strategy-map',
        props: {
          theme: 'orange',
          title: '场景应用',
          eyebrow: 'SCENARIO · 微服务',
          blocks: [
            { kind: 'columns', label: '', items: [
              { title: '安防', items: ['指挥中心', '告警处置', '以图搜图', '视频巡更', '安消联动'] },
              { title: '通行', items: ['用户同步', '人脸库', '通行记录', '门禁管理', '通行权限'] },
              { title: '停车', items: ['车位管理', '车辆管理', '进出管理', '访客联动', '充电桩状态'] },
              { title: '访客', items: ['访客申请', '访客签到', '访客设置', '访客机管理', '统计分析'] },
              { title: '工位', items: ['地图管理', '固定工位', '共享预定', '工位大屏', '工位统计'] },
              { title: '会议', items: ['会议室沙盘', '预定会议', '预定记录', '使用分析', '审批规则'] },
              { title: '厕位', items: ['厕纸平台', '厕位占用', '环境采集', '排风新风', '厕位 PAD'] },
              { title: '能耗', items: ['能耗采集', '能耗监测', '用能统计', '双碳管理', '辅助决策'] },
              { title: '信息', items: ['素材管理', '投放排期', '审批管理', '设备管理', '系统配置'] },
              { title: '报修', items: ['工单管理', '工单流程', '工单统计', '设备台账', '巡检计划'] },
              { title: '运营', items: ['安防看板', '告警看板', '通行看板', '环境看板', '会议看板'] },
              // 楼宇智控取自 buildingos_web 菜单「运营 → 楼宇智控」下的末端（共 16 个，
              // 列高只放得下 10 个，这里按菜单顺序取前 10；剩下的是 平板/厕位/电路/空净/新风/排风
              { title: '智控', items: ['智能策略', '照明空调', '人感空感', '环境烟雾', '电量水量'] },
            ] },
          ],
        },
        box: { x: 1.5, y: 70.5, w: 78, h: 28.5 },
      },
      'devices': {
        type: 'strategy-map',
        props: {
          theme: 'orange',
          title: '设备层',
          eyebrow: 'DEVICE',
          blocks: [
            { kind: 'chips', label: '基础设施', items: ['楼控', '空调', '新风', '照明', '电梯', '消防', '能耗', '监控','安防'] },
            { kind: 'chips', label: '智能硬件', items: ['门禁', '摄像机', '平板', '门牌', '空感', '人感', '开关', '电量','水量'] },
            { kind: 'chips', label: '边缘网关', items: ['IoT网关', 'AI网关'] },
          ],
        },
        box: { x: 81, y: 70.5, w: 17.5, h: 28.5 },
      },
    },
    views: canvasViews(['strategy', 'capabilities', 'integration', 'scenarios', 'devices'], {
      id: 'overview',
      view: {
        title: '吉利集团统一智慧园区框架方案',
        description: '一个平台、一套标准、多属地复制：IOC 是入口，能力层是底座，场景是微服务，设备层是触角。',
        metrics: [
          { label: '微服务', value: '12 个' },
          { label: '领域能力', value: '8 项' },
          { label: '接入设备', value: '18 类' },
        ],
      },
    }),
  },
};


/**
 * 场景对标 —— 12 个场景围着模型排一圈，点开看四列对标表。
 *
 * 节点位置是百分比，中间那块留空给三维模型（卡片本身不吃鼠标，所以空白处能拖模型）。
 * 对标内容在 details 里，每行一个维度、四列依次是 Smart 园区 / 吉行园区 / 望潮 / 吉利集团。
 * 目前只有望潮那列填了从那张智能建筑图里能对上的部分，其余是「待补充」——
 * 弹窗里会把这些格子画淡，一眼看得出还缺哪些。
 */
const RING_NODES = [
  { id: 'security', name: '安防', icon: 'shield', x: 5.5, y: 18 },
  { id: 'pass', name: '通行', icon: 'door', x: 5.5, y: 38 },
  { id: 'parking', name: '停车', icon: 'car', x: 5.5, y: 58 },
  { id: 'visitor', name: '访客', icon: 'users', x: 5.5, y: 78 },
  { id: 'energy', name: '能耗', icon: 'energy', x: 94.5, y: 18 },
  { id: 'workstation', name: '工位', icon: 'floors', x: 94.5, y: 38 },
  { id: 'meeting', name: '会议', icon: 'grid', x: 94.5, y: 58 },
  { id: 'toilet', name: '厕位', icon: 'drop', x: 94.5, y: 78 },
  { id: 'operations', name: '运营', icon: 'chart', x: 29, y: 10 },
  { id: 'control', name: '智控', icon: 'device', x: 71, y: 10 },
  { id: 'publish', name: '信息', icon: 'bell', x: 29, y: 86 },
  { id: 'maintance', name: '报修', icon: 'settings', x: 71, y: 86 },
];

// 顶部那句定义（老 PPT 里 IOC 智慧运营中心 那条横幅）
const RING_BANNER = {
  title: '智能樓宇系統',
  text: '把分散的系统、设备、事件、人员和数据汇聚到统一界面，让运营人员「看得见、派得出、追得回、复得清」。',
};

// 底部那条运营闭环（老 PPT 最下面五步）
const RING_LOOP = [
  { title: '实时感知', sub: '人 / 车 / 物 / 安防 / 环境' },
  { title: '智能预警', sub: 'AI 识别 / 阈值告警 / 风险提示' },
  { title: '联动处置', sub: '视频弹窗 / 门禁联动 / 人员通知' },
  { title: '工单闭环', sub: '自动派单 / 处理留痕 / 超时升级' },
  { title: '数据复盘', sub: '统计分析 / 趋势研判 / 策略优化' },
];

// 老 PPT 中间那六块的「用 / 例」，按管理域落到 12 个场景上
const USAGE = {
  security: {
    usage: '统一查看视频、消防、报警、AI 识别和巡更状态；异常时定位点位、弹出视频、派发安保工单并留痕。',
    example: 'AI 识别人员闯入管控区域，平台自动告警并联动附近视频；运营人员确认后一键派单，处理结果回传。',
  },
  pass: {
    usage: '统一管理人员、访客、车辆、门禁、闸机、停车场和电梯，保留完整通行记录与轨迹。',
    example: '访客小程序预约，审批后自动下发门禁 / 车行权限；超权进入时定位告警并推送视频。',
  },
  parking: {
    usage: '统一管理人员、访客、车辆、门禁、闸机、停车场和电梯，保留完整通行记录与轨迹。',
    example: '访客小程序预约，审批后自动下发门禁 / 车行权限；超权进入时定位告警并推送视频。',
  },
  visitor: {
    usage: '统一管理人员、访客、车辆、门禁、闸机、停车场和电梯，保留完整通行记录与轨迹。',
    example: '访客小程序预约，审批后自动下发门禁 / 车行权限；超权进入时定位告警并推送视频。',
  },
  operations: {
    usage: '统一调度会议室、工位、餐厅、环境、信息发布等日常资源，提升空间利用率和员工体验。',
    example: '会议预约后自动同步门禁、灯光、空调和投影；会后检测无人，自动关闭设备并释放会议室资源。',
  },
  workstation: {
    usage: '统一调度会议室、工位、餐厅、环境、信息发布等日常资源，提升空间利用率和员工体验。',
    example: '会议预约后自动同步门禁、灯光、空调和投影；会后检测无人，自动关闭设备并释放会议室资源。',
  },
  meeting: {
    usage: '统一调度会议室、工位、餐厅、环境、信息发布等日常资源，提升空间利用率和员工体验。',
    example: '会议预约后自动同步门禁、灯光、空调和投影；会后检测无人，自动关闭设备并释放会议室资源。',
  },
  publish: {
    usage: '统一调度会议室、工位、餐厅、环境、信息发布等日常资源，提升空间利用率和员工体验。',
    example: '会议预约后自动同步门禁、灯光、空调和投影；会后检测无人，自动关闭设备并释放会议室资源。',
  },
  energy: {
    usage: '实时掌握水、电、照明、空调、充电桩等能耗，识别异常用能，按场景策略联动设备节能。',
    example: '办公楼夜间用电异常升高，运营人员查看楼层和设备状态，远程关闭未关照明 / 空调或生成工单。',
  },
  control: {
    usage: '集中监控门禁、监控、空调、新风、电梯、照明、给排水、变配电等设备状态和资产档案。',
    example: '水泵或配电设备异常时，系统定位设备并展示厂家、联系人、维保周期，联动视频和维修工单闭环。',
  },
  maintance: {
    usage: '把报修、巡检、报警、派单、处理、复盘统一起来，支持报警分级、自动派单和超时升级。',
    example: '环境传感器检测 CO2 / 水位异常后自动告警，联动新风或排水设备，并向运维人员推送处置工单。',
  },
  toilet: {
    usage: '把报修、巡检、报警、派单、处理、复盘统一起来，支持报警分级、自动派单和超时升级。',
    example: '环境传感器检测 CO2 / 水位异常后自动告警，联动新风或排水设备，并向运维人员推送处置工单。',
  },
};

const TODO = '待补充';

// 场景简述：来自 buildingos.software/docs 各微服务操作说明书的「系统概述」
const SCENE_SUMMARY = {
  security: '一体化安防管理方案：以 三维地图为指挥载体，集成视频监控、门禁、周界、消防等多子系统告警数据，实现告警从接收、处理、分发、转派到关闭的全生命周期闭环管理。',
  pass: '综合性通行管理平台：集成人员信息管理、生物特征识别（人脸/指纹）、二维码/IC 卡验证、门禁设备控制、访客预约审批与梯控联动，建立统一身份认证体系，实现「授权—通行—审计」全流程数字化。',
  parking: '数字化停车管理平台：以「停车区域→停车位」两级资源模型精细配置车位，与道闸、车牌识别、充电桩等设备集成，车辆进出自动识别放行，并与访客系统原生联通。',
  visitor: '数字化访客管理平台：通过微信小程序、Web 端等多渠道自助预约与邀请，与门禁、梯控、停车场联动，实现「一次登记、全域通行」，并以实名核验和黑白名单构建安全防线。',
  workstation: '工位资源管理平台：以三维室内地图为载体，在真实楼层平面图上叠加展示工位，支持固定工位全生命周期管理、共享工位在线预定与冲突检测，并通过传感器实时同步占用状态。',
  meeting: '综合性会议管理平台：集成会议预约管理、信息发布、环境设备控制（IoT）与音视频会议控制，解决预定冲突、设备操作繁琐、资源闲置等问题，实现会议全生命周期数字化管理。',
  toilet: '公共设施管理平台：通过物联网实时感知卫生间占用状态、环境质量（异味/温湿度）与耗材余量，用引导屏分流，并基于数据生成清洁工单。',
  energy: '边缘计算层：向下连接物联网网关与终端设备，向上与总部私有云同步，实现低延迟响应、协议转换（Modbus/BACnet/OPC UA → MQTT）与断网离线运行。',
  operations: '运营管理系统：覆盖园区运营业务的过程管理与数据统计，是各场景业务在运营侧的入口。',
  control: '楼宇智控系统：对接园区空调、照明、电梯与物联网设备，按策略执行开关与调节，并对运行状态做监控与故障告警。',
  publish: '楼宇可视化大屏系统：面向大屏展示与监控，支持多数据源接入与自定义布局。',
  maintance: '综合性维护管理平台：覆盖工单全生命周期、设备台账维保追溯与巡检任务自动调度；支持手动报单、扫码、设备告警触发、巡检自动生成四种工单来源，内置流程引擎、SLA 时效与统计看板。',
};

// 对标内容：来自《参考》PPT 第 30–39 页各场景的功能对比表。每行是
// [功能项, Smart, 极氪, 吉行, 解决什么问题]。第二格是当前项目 Smart 的
// 情况，可以是「✔ 集成海康」这类说明，也可以是「- 需要增加AI算法」这种缺口。
const BENCH = {
  security: [
    ['人流统计', '✔ 集成海康', '✔', '✔', '统计进出场所的人员数，便于掌握人流情况、分析各时段人流量。'],
    ['人脸识别 · 无感通行', '✔ 集成海康', '✔', '✔', '识别画面中的人员是否与人脸库一致，实现无感通行。'],
    ['移动侦测 · 区域防范', '✔ 集成海康', '✔', '✔', '档案室、外围等重点区域的入侵监测告警。'],
    ['周界入侵', '✔ 集成海康', '✔', '✔', '识别园区周界画面中的非公司员工异常闯入。'],
    ['烟雾识别', '- 需要增加AI算法', '✔', '✔', '检测楼梯间、垃圾房等区域是否有人吸烟，检出即报警提醒处置。'],
    ['睡岗 / 离岗识别', '- 需要增加AI算法', '✔', '✔', '识别保安厅、消控室等指定区域人员是否在岗，超时离岗告警。'],
    ['人员空位监测', '- 需要增加AI算法', '✔', '✔', '判断工位有无人，联动空调、照明设备开关。'],
    ['人员轨迹分析', '- 需要增加AI算法', '✔', '✔', '通过人脸与体态识别，形成园区黑名单轨迹与以图搜图。'],
  ],
  pass: [
    ['人脸认证 · 入园闸机', '✔ 集成海康', '✔', '✔', '访客预约登记后扫码快速入园，提升入园效率；分权限、分区域管控，只有授权人员可进入。'],
    ['刷卡 · 电梯厅闸机', '✔ 集成海康', '✔', '✔', '同上，覆盖电梯厅闸机的分权限通行。'],
    ['扫码 · 办公层门禁', '✔ 集成海康', '✔', '✔', '同上，覆盖办公层门禁。'],
    ['访客单打印机', '- 需要对接集团访客', '✔', '—', '纸质访客单容易造成保安厅访客排队拥堵。'],
  ],
  parking: [
    ['室外剩余车位显示', '- 集成停车系统', '✔', '✔', '提高车位利用率，缓解停车难。'],
    ['单、双向空余车位诱导', '- 集成停车系统', '✔', '✔', '引导车辆快速找到空位。'],
    ['车辆占位检测', '- 集成停车系统', '✔', '✔', '检测车位占用状态。'],
    ['自助缴费', '- 集成停车系统', '✔', '✔', '减少出口排队。'],
    ['地锁联动', '- 集成停车系统', '✔', '✔', '预约车位与地锁联动。'],
    ['VP 固定车位占用告警', '- 集成停车系统', '✔', '✔', '固定车位被非匹配车牌占用时告警推送安保，及时电话联系处理。'],
  ],
  meeting: [
    ['会议资源管理', '- 需要对接集团会议', '✔', '✔', '标准定义会议室命名、用户分级、权限分级，统一预约入口。'],
    ['会议预约管理', '- 需要对接集团会议', '✔', '✔', '识别常用会议室靠前推荐；多日程打通；重要会议资源保障；多次预定未参会通过策略管控提升利用率。'],
    ['会议决策管理', '- 需要对接集团会议', '✔', '✔', '重要会议室预约关联接待行政审批，确保会议无冲突。'],
    ['会中体验', '- 需要对接集团会议', '✔', '✔', '占位检测联动照明、空调等设备自动开关，解决设备复杂不会操作的问题。'],
    ['会后督办', '- 需要对接集团会议', '✔', '✔', '保洁等服务事项闭环督办。'],
  ],
  operations: [
    ['进销存管理系统', '-', '✔', '✔', '保证食品从议价、请购、采购、验货、入库到出库全流程透明管控。'],
    ['食品安全', '-', '✔', '✔', '样品留样可追溯，明厨亮灶阳光厨房。'],
    ['就餐体验', '-', '✔', '✔', '快餐线自助结算，提升结算效率、减少人为算价误差。'],
    ['餐厅数字大屏', '-', '✔', '✔', '多维度展示餐厅运营数据，管理者与用户都能直观了解当前状态。'],
  ],
  energy: [
    ['控制外机', '✔', '✔', '✔', '集控外机减少设备用量、便于排查故障；外机是冷热交换主体，控制它更省能耗。场景：办公区用摄像头 + AI 识别人是否在工位，结合考勤与定时任务判定关闭；会议室占位定时检测无人关闭。'],
    ['控制内机', '✔', '✔', '✔', '租赁办公或集中冷源的空调系统由物业管理的场合，通过串联 485 控制线到网关控制内机。'],
    ['照明回路控制', '✔', '✔', '✔', '办公区结合室内装修照明设计做回路控制，会议室、领导办公室等独立空间独立回路；约 900 个回路。'],
    ['远程抄表与能耗校验', '✔', '✔', '✔', '远程抄表与能耗统计互相校验，确保数据准确；无需下班后巡楼检查，减少运维人力。'],
    ['计费管理', '- 独立开发', '✔', '✔', '根据用户使用情况，自动计算费用，无需人工干预。'],
    ['能耗统计', '- 独立开发', '✔', '✔', '实时展示能耗，帮助用户优化能耗。'],
  ],
  control: [
    ['DDC 标准协议对接', '✔', '✔', '✔', '通过 BACnet、LONWORKS、Modbus 等标准协议定义数据交换方式，不同厂商设备可互通。'],
    ['设备状态监控与告警', '✔', '✔', '✔', '由人工巡检改为系统主动告警，及时发现设备故障并处置，提升设备运行健康度。'],
    ['物联网设备批量处理', '✔', '✔', '✔', '批量处理各类传感器与网关设备。'],
  ],
  workstation: [
    ['工位需求预估', '-', '✔', '✔', '按业务预估工位需求，避免超配与不足。'],
    ['工位分配与运营', '-', '✔', '✔', '可视化分配与运营，提高空间利用率、降低成本。'],
    ['员工自行绑定', '-', '✔', '✔', '员工自助绑定工位。'],
  ],
  maintance: [
    ['报事报修全链路', '-', '✔', '✔', '覆盖报修、维修、巡检、工单管理与人员考核。'],
    ['报修单管理', '-', '✔', '✔', '报修单管理，及时处理报修单。'],
    ['维修单管理', '-', '✔', '✔', '维修单管理，及时处理维修单。'],
    ['巡检单管理', '-', '✔', '✔', '巡检单管理，及时处理巡检单。'],
    
  ],
};

const RING_DETAILS = Object.fromEntries(RING_NODES.map(node => [node.id, {
  title: node.name,
  desc: SCENE_SUMMARY[node.id] || '四个环境里这一项各自是怎么落地的。',
  usage: (USAGE[node.id] || {}).usage || '',
  example: (USAGE[node.id] || {}).example || '',
  rows: (BENCH[node.id] || []).map(([dim, smart, a, b, why]) => ({ dim, values: [smart, a, b, why] })),
}]));


const scenarioPage = {
  id: 'scenarios',
  name: '12大场景按需落地 对标已完成项目',
  view: 'overview',
  camera: { position: [0, 175, 285], target: [0, 10, -22] },
  // 页面级覆盖层：不是卡片，没有面板外壳，浮在模型上面的一层注释
  overlays: [
    {
      title: '12大场景按需落地 对标已完成项目',
        banner: RING_BANNER,
        loop: RING_LOOP,
      nodes: RING_NODES,
      columns: ['Smart（当前项目）', '极氪', '吉行', '解决什么问题'],
      details: RING_DETAILS,
    },
  ],
  overrides: {
    // 布局还是写 free-canvas（区域名得是布局里有的），只是卡片列表是空的
    layout: 'free-canvas',
    views: canvasViews([], {
      id: 'overview',
      view: {
        title: '场景对标',
        description: '12 个场景，点开看 Smart 园区、吉行园区、望潮、吉利集团各自怎么落地。',
        metrics: [
          { label: '场景', value: '12 个' },
          { label: '对标环境', value: '4 个' },
          { label: '已填内容', value: '望潮' },
        ],
      },
    }),
  },
};

/**
 * BuildingOS 技术架构 —— 从云端到设备的四层。
 *
 * 结构参照 buildingos.slides 的 tech-architecture 布局（服务前端 / 业务中台 /
 * 技术中台 + 基建层），但按「云 → 园区边缘 → 网关 → 设备」重新排成一条竖线：
 * 上面是集团侧的云，中间是 Smart 园区的边缘平台，再往下是边缘网关和现场设备。
 *
 * 和场景环一样是页面级覆盖层，不是卡片 —— 整页就是一张图，中间不留模型。
 */
const ARCHITECTURE_PAGE = {
  id: 'architecture',
  name: 'BuildingOS 技术架构',
  view: 'overview',
  // 抬高注视点，把模型压到画面下半部分 —— 那里正好是边缘虚线框留空的地方
  camera: { position: [0, 250, 320], target: [0, 95, -23] },
  overlays: [{
    kind: 'tech-architecture',
    title: 'BuildingOS 技术架构',
    // 点右上角这四个标签会弹出配图。图从 buildingos.slides 的 geey 演示里拷过来的，
    // 对应关系直接照它 modals/ 下那几个 md 里引用的图片。
    feature: [
      {
        name: 'IoT Architecture',
        images: [
          { src: '/tech/iotArc_light.png', caption: 'BuildingOS 专用 IoT 架构：逻辑解耦、物理聚合' },
          { src: '/tech/iotArc1_light.png', caption: '传统 IT 架构 vs. BuildingOS 架构' },
          { src: '/tech/Architecture.png', caption: '架构模式对比：请求驱动 vs. 闭环反馈' },
        ],
      },
      {
        name: 'High Availability',
        images: [
          { src: '/tech/ha1.png', caption: 'K8s 容器化编排与多租户解耦，可用性 99.99%' },
          { src: '/tech/ha2_light.png', caption: '云管端多级分散部署' },
        ],
      },
      {
        name: 'High Performance',
        images: [
          { src: '/tech/ha3_light.png', caption: 'Node-RED + MQTT + TDengine 技术选型' },
          { src: '/tech/ha5_light.png', caption: '时序数据库' },
          { src: '/tech/ha4_light.png', caption: '边缘分担，压力降低 90%' },
        ],
      },
      {
        name: 'BaaS',
        images: [
          { src: '/tech/baas.png', caption: 'BaaS 模式（楼宇即服务）' },
          { src: '/tech/output.png', caption: '标准化输出清单' },
        ],
      },
    ],
    frontend: [
      { name: 'H5 / WeChat', icon: 'users' },
      { name: 'Web PC / Admin', icon: 'grid' },
      { name: 'Pad / Control Panel', icon: 'device' },
      { name: 'API 中心', icon: 'link' },
      { name: '运维指南', icon: 'info' },
      { name: '运营机器人', icon: 'settings' },
      { name: 'IOC 大屏', icon: 'chart' },
      { name: 'AI 知识中心', icon: 'orbit' },
    ],
    business: {
      title: '业务中台 (Microservices)',
      modules: [
        { name: 'Space Model (空间)' },
        { name: 'Device Twin (孪生)' },
        { name: 'Access Logic (通行)' },
        { name: 'Energy Metering (能耗)' },
        { name: 'Alarm Center (告警)' },
        { name: 'Visitor System (访客)' },
        { name: 'Billing Engine (计费)' },
      ],
    },
    tech: {
      title: '技术中台 (Technical Platform)',
      components: [
        { name: 'IoT Gateway', desc: 'Node-RED' },
        { name: 'Message Bus', desc: 'EMQX MQTT 5.0' },
        { name: 'TSDB', desc: 'TDengine' },
        { name: 'Backend & API', desc: 'NestJS + Python' },
        { name: 'AI LLM', desc: 'LangChain' },
        { name: 'AI Vision', desc: 'YOLO + ZLMediaKit' },
      ],
    },
    infra: {
      title: '基建层 (Infrastructure)',
      items: [
        { name: 'PaaS（联通私有云平台）' },
        { name: 'Kubernetes (K8s)' },
        { name: 'HCI（超融合）' },
        { name: 'Docker' },
      ],
    },
    edge: {
      title: '边缘计算 (Edge) · Smart 园区边缘平台',
      buildings: [
        { name: 'Building A', gateways: [{ name: 'IoT Edge' }, { name: 'AI Edge' }] },
        { name: 'Building B', gateways: [{ name: 'IoT Edge' }, { name: 'AI Edge' }] },
        { name: 'Building C', gateways: [{ name: 'IoT Edge' }, { name: 'AI Edge' }] },
      ],
    },
    devices: {
      gateway: ['IoT 网关', 'AI 边缘网关'],
      infrastructure: ['楼控', '空调', '新风', '照明', '电梯', '消防', '能耗', '监控'],
      smart: ['门禁', '摄像机', '平板', '门牌', '空气传感', '人体传感', '智能开关', '机器人'],
    },
  }],
  overrides: {
    layout: 'free-canvas',
    views: canvasViews([], {
      id: 'overview',
      view: {
        title: 'BuildingOS 技术架构',
        description: '云在集团、边缘在园区、网关和设备在现场：一套平台从集团铺到每一栋楼。',
        metrics: [
          { label: '分层', value: '4 层' },
          { label: '微服务', value: '7 个' },
          { label: '边缘节点', value: '3 栋' },
        ],
      },
    }),
  },
};

/**
 * 封页 —— 0 号页。参考那张 PPT 封面：白底浅弧、左上角品牌、中间大标题、左下角汇报信息。
 * bare: true 表示这一页不要演示顶栏（标题已经在画面里了，顶栏再来一遍就重了）。
 * 品牌标是先按截图拼的，有正式 logo 图片的话换成 img 就行。
 */
const COVER_PAGE = {
  id: 'cover',
  name: 'Smart园区智能化建设项目阶段性总结',
  bare: true,
  view: 'overview',
  camera: { position: [150, 165, 250], target: [0, 0, -23] },
  overlays: [{
    kind: 'cover',
    title: 'Smart园区智能化建设项目阶段性总结',
    // 汇报信息：时间 + 人。名字还没定，先占位，改这一行就行
    bullets: ['数字化共享中心', '汇报时间：2026.09', '汇报人：待填'],
  }],
  overrides: {
    layout: 'free-canvas',
    views: canvasViews([], {
      id: 'overview',
      view: {
        title: 'Smart园区智能化建设项目阶段性总结',
        description: '数字化共享中心 · 2026.09 汇报。',
        metrics: [
          { label: '汇报', value: '2026.06' },
          { label: '单元', value: '数字化共享中心' },
          { label: '类型', value: '阶段性总结' },
        ],
      },
    }),
  },
};

/**
 * 项目执行计划 —— 一条时间轴。
 *
 * 元素照客户给的那张进度图：中间一条轴、里程碑上下交替、日期贴着轴、
 * 两条阶段分隔线（第二条虚线）、底部三个阶段成果条。
 * x 是沿轴的百分比位置，date 是轴上的橙色日期，side 决定在轴上还是轴下。
 */
const TIMELINE_PAGE = {
  id: 'plan',
  name: '项目执行计划',
  view: 'overview',
  camera: { position: [0, 195, 285], target: [0, 8, -23] },
  overlays: [{
    kind: 'timeline',
    title: '园区智能化系统交付计划',
    range: '08.03 平台部署 · 09.30 全园区试运营完成',
    sideTitle: '交付概览',
    stats: [
      { value: '2', unit: '条', label: '并行交付线' },
      { value: '6', unit: '个', label: '交付阶段' },
    ],
    // 两条线并行：总部大楼先接设备，造型中心晚两周，最后一起进全园区试运营。
    // 首尾两个阶段两条线共用，所以两边都列一遍。
    lanes: [
      {
        name: '总部大楼', range: '08.03 — 09.30', color: '#2f6fd0',
        marks: [
          {
            date: '08.03 — 08.09', label: '平台与空间就绪',
            items: ['本地 IOT 平台部署', '许可部署', '私有云 Smart 园区空间创建'],
          },
          {
            date: '08.10 — 08.23', label: '设备接入与私有云上线',
            items: ['物联网设备', '智能硬件', '本地 IOT 平台对接', '私有云系统上线'],
          },
          {
            date: '09.01 — 09.13', label: '运营功能上线试运营',
            items: ['场景策略'],
          },
          {
            date: '09.21 — 09.30', label: '全园区试运营、调优',
            items: ['全园区智能化系统试运营', '调优'], hot: true,
          },
        ],
      },
      {
        name: '造型中心', range: '08.03 — 09.30', color: '#12a5a5',
        marks: [
          {
            date: '08.03 — 08.09', label: '平台与空间就绪',
            items: ['本地 IOT 平台部署', '许可部署', '私有云 Smart 园区空间创建'],
          },
          {
            date: '08.24 — 08.31', label: '设备接入与私有云上线',
            items: ['物联网设备', '智能硬件', '本地 IOT 平台对接', '私有云系统上线'],
          },
          {
            date: '09.14 — 09.20', label: '运营功能上线试运营',
            items: ['场景策略'],
          },
          {
            date: '09.21 — 09.30', label: '全园区试运营、调优',
            items: ['全园区智能化系统试运营', '调优'], hot: true,
          },
        ],
      },
    ],
    // 月份轴按周切
    ticks: [
      { x: 2, label: '08.03', sub: '启动' }, { x: 14, label: '08.10' },
      { x: 26, label: '08.17' }, { x: 38, label: '08.24' },
      { x: 50, label: '08.31' }, { x: 62, label: '09.07' },
      { x: 74, label: '09.14' }, { x: 86, label: '09.21' },
      { x: 98, label: '09.30', sub: '完成' },
    ],
  }],
  overrides: {
    layout: 'free-canvas',
    views: canvasViews([], {
      id: 'overview',
      view: {
        title: '项目执行计划',
        description: '总部大楼与造型中心两条线并行推进，前两周共平台，末十天合并进全园区试运营。',
        metrics: [
          { label: '交付线', value: '2 条' },
          { label: '阶段', value: '6 个' },
          { label: '完成', value: '09.30' },
        ],
      },
    }),
  },
};



const TOPO_LEGEND = [
  { label: '感知识别层', color: '#e8547c' },
  { label: '边缘协议网关', color: '#3d7ae0' },
  { label: '核心传输层', color: '#1f3a52' },
  { label: '平台与云服务', color: '#e36c0a' },
];

const TOPO_COLUMNS = [
  {
    no: '01', name: '感知与终端层',
    nodes: [
      { kind: 'group', tone: 'pink', title: '', items: [{ icon: 'users', label: '人体设备' }, { icon: 'temp', label: '环境设备' }], foot: '433MHz / CoSS' },
      { kind: 'group', tone: 'blue', title: '', items: [{ icon: 'wind', label: '空调外机' }], foot: 'RS485 / CoSS' },
      { kind: 'group', tone: 'yellow', title: '', items: [{ icon: 'sun', label: '公区灯光' }] },
      { kind: 'group', tone: 'green', title: '', items: [{ icon: 'energy', label: '电表' }, { icon: 'drop', label: '水表' }], foot: 'RS485 / DL/T645' },
    ],
  },
  {
    no: '02', name: '网关与采集层',
    nodes: [
      { kind: 'card', tone: 'blue', name: '智慧中心 PRO', desc: '多协议接入智能中枢' },
      { kind: 'card', tone: 'blue', name: '空调网关', desc: 'RS485 / CoSS 转换' },
      { kind: 'card', tone: 'blue', name: 'KNX网关）', desc: 'KNX / Modbus 转换' },
      { kind: 'card', tone: 'blue', name: '照明控制模块）', desc: 'KNX 总线控制模块' },
      { kind: 'card', tone: 'blue', name: '能耗采集器', desc: '含 RS485 / 188 转换器' },
      { kind: 'card', tone: 'green', name: '转换器', desc: 'Mbus 协议转换' },
      { kind: 'chip', label: 'KNX 协议' },
      { kind: 'chip', label: 'Modbus-TCP' },
      { kind: 'chip', label: 'TCP/IP or MQTT' },
    ],
  },
  {
    no: '03', name: '核心传输层',
    nodes: [
      { kind: 'card', tone: 'dark', name: '交换机（三层）', badge: 'L3', desc: '仅示例，以实际网络为主' },
      { kind: 'card', tone: 'dark', name: '交换机（三层）', badge: 'L3', desc: '仅示例，以实际网络为主' },
      { kind: 'card', tone: 'blue', name: '交换机（二层）', badge: '核心 L2', desc: '汇聚交换机 · 双路热备' },
      { kind: 'chip', label: '网波 / TCP/IP 协议' },
      { kind: 'chip', label: '网波 / 光纤' },
    ],
  },
  {
    no: '04', name: '内网应用平台层',
    nodes: [
      { kind: 'card', name: '本地服务器 #1', badge: 'INSPUR', blocks: [{ title: '视频流服务器', sub: 'IP: 10.XX.XX.XX' }] },
      { kind: 'card', name: '本地服务器 #2', badge: 'INSPUR', blocks: [{ title: '边缘 IoT', sub: 'IP: 10.XX.XX.XX' }, { title: '设备控制应用', sub: 'IP: 10.XX.XX.XX' }] },
      { kind: 'chip', label: '网波 / TCP/IP 协议' },
    ],
  },
  {
    no: '05', name: '隔离与外网层',
    nodes: [
      { kind: 'isolator', left: '内网', right: '外网', label: '防火墙 · NAT 隔离' },
      { kind: 'card', tone: 'warn', name: '防火墙端口转发', desc: 'NAT 配置 / VPN 反向代理' },
      { kind: 'card', name: '吉利集团云服务', blocks: [{ title: '集团服务', sub: 'IP: 10.XX.XX.XX' }] },
      { kind: 'chip', label: 'NAT / VPN 映射' },
    ],
  },
];

const TOPOLOGY_PAGE = {
  id: 'topology',
  name: '智能化控制逻辑图',
  view: 'overview',
  // 背景用 Smart 总部 1F 的室内平面（它是 Vue 组件型场景，不是 WebGL 工厂）
  studio: true,
  // 1F 平面用的是正交相机，坐标和园区世界坐标不是一回事：这里就是平面俯视机位
  camera: { position: [0, 160, 0.01], target: [0, 0, 0] },
  overlays: [{
    kind: 'system-topology',
    title: '物联网及智能化设备端到端网络拓扑架构',
    legend: TOPO_LEGEND,
    columns: TOPO_COLUMNS,
    // 走线：节点用「列序号-节点序号」指。设备 → 网关 → 交换机 → 服务器 → 防火墙 → 外网
    links: [
      ['0-0', '1-0'], ['0-1', '1-1'], ['1-1', '1-2'], ['0-2', '1-3'], ['0-3', '1-4'], ['1-4', '1-5'],
      ['1-0', '2-0'], ['1-2', '2-0'], ['1-3', '2-2'], ['1-5', '2-1'],
      ['2-0', '2-2'], ['2-1', '2-2'],
      ['2-2', '3-0'], ['2-2', '3-1'],
      ['3-0', '4-1'], ['4-1', '4-2'],
    ],
  }],
  overrides: {
    layout: 'free-canvas',
    scene: { main: { provider: 'smart-floor-bg' } },
    views: canvasViews([], {
      id: 'overview',
      view: {
        title: '智能化控制逻辑图',
        description: '从现场设备到集团云，五层逐级汇聚；内网与外网之间用防火墙和 NAT 隔离。',
        metrics: [
          { label: '层级', value: '5 层' },
          { label: '协议', value: 'KNX/Modbus/MQTT' },
          { label: '隔离', value: '防火墙 · NAT' },
        ],
      },
    }),
  },
};


/**
 * 空调设备分布 —— 数据来自《smart空调配置信息2026.8.15.xlsx》。
 *
 * 表里 9 个工作表就是 9 个集控区域，每张表一行一台室内机，合计 395 台，
 * 每个区域配一台美的集控平台（IP 段 10.97.180.241—249）。
 * 这里按区域把台数标到 1F 地图上，卡片和地图之间用引导线连起来。
 */
const DEVICE_GROUPS = [
  { name: '总部 1F', count: 54, icon: 'wind', color: '#2f6fd0', at: [44, 38], side: 'right' },
  { name: '总部 2F', count: 97, icon: 'wind', color: '#2f9fd0', at: [50, 50], side: 'right' },
  { name: '总部 3F', count: 96, icon: 'wind', color: '#1f5c94', at: [56, 62], side: 'right' },
  { name: '造型 2F 办公共享区', count: 32, icon: 'grid', color: '#12a5a5', at: [66, 30], side: 'right' },
  { name: '造型 1F 门厅', count: 20, icon: 'device', color: '#e36c0a', at: [24, 30], side: 'left' },
  { name: '造型 1F 数字评审室', count: 17, icon: 'grid', color: '#7a5cd0', at: [32, 22], side: 'left' },
  { name: '造型 1F 室内评审室', count: 18, icon: 'grid', color: '#8a6fd8', at: [28, 46], side: 'left' },
  { name: '造型 1F 餐厅', count: 37, icon: 'sun', color: '#2e9e4f', at: [20, 62], side: 'left' },
  { name: '造型模型及 2F 夹层', count: 24, icon: 'energy', color: '#d99b26', at: [36, 70], side: 'left' },
];

const DEVICE_PAGE = {
  id: 'device-map',
  name: '空调设备分布',
  view: 'overview',
  studio: true,
  // 和拓扑页同一个 1F 平面背景，机位稍微错开
  camera: { position: [0, 158, 0.01], target: [0, 0, 0] },
  overlays: [{
    kind: 'device-map',
    title: '美的空调设备分布',
    subtitle: '按集控区域分项统计 · 数据源：smart空调配置信息 2026.8.15',
    // 右下角是全部设备总数：空调 395 + 梦想公园（含智能箱）865
    total: { value: 1404, unit: '台', label: '设备 1,328 + 网关 76' },
    groups: DEVICE_GROUPS,
    // 另两张表的汇总：梦想公园按设备类型 7 类，SMART 智能箱按设备类型 7 类
categories: [
      {
        title: '设备', color: '#1f3a52',
        // 来自 2026-09-13 版 iot_device（1328 台）和 iot_gateway（76 台）。
        // 空调那 395 台和下面地图上的分项是同一份数据，只是这里按类型再数了一遍。
        items: [
          { name: '空调', count: 395, icon: 'wind', color: '#2f6fd0', detail: 'dev_airconditioning' },
          { name: '照明', count: 307, icon: 'sun', color: '#d99b26', detail: 'dev_light' },
          { name: '烟感', count: 133, icon: 'temp', color: '#e36c0a', detail: 'dev_smokesensor' },
          { name: '厕位传感器', count: 128, icon: 'device', color: '#7a5cd0', detail: 'dev_wcsensor' },
          { name: '电量采集器', count: 107, icon: 'energy', color: '#12a5a5', detail: 'dev_powersensor' },
          { name: '控制屏', count: 98, icon: 'grid', color: '#2f9fd0', detail: 'dev_pad' },
          { name: '水表', count: 57, icon: 'drop', color: '#2e9e4f', detail: 'dev_watersensor' },
          { name: '人体传感器', count: 47, icon: 'users', color: '#5b8def', detail: 'dev_humensensor' },
          { name: '环境传感器', count: 44, icon: 'temp', color: '#16a34a', detail: 'dev_airsensor' },
          { name: '水浸传感器', count: 12, icon: 'drop', color: '#c0392b', detail: 'dev_inundationsensor' },
        ],
      },
      {
        title: '网关', color: '#2f6fd0',
        items: [
          { name: '边缘网关', count: 75, icon: 'energy', color: '#e36c0a', detail: 'dev_edge' },
          { name: '主网关', count: 1, icon: 'grid', color: '#1f5c94', detail: 'dev_main' },
        ],
      },
    ],
  }],
  overrides: {
    layout: 'free-canvas',
    scene: { main: { provider: 'smart-floor-bg' } },
    views: canvasViews([], {
      id: 'overview',
      view: {
        title: '空调设备分布',
        description: '按 2026-09-13 版设备台账：设备 1,328 台、网关 76 台，空调按区域落到 1F 地图上。',
        metrics: [
          { label: '设备', value: '1,328 台' },
          { label: '网关', value: '76 台' },
          { label: '区域', value: '9 个' },
        ],
      },
    }),
  },
};

/**
 * 1F 设备实拍与安装位置 —— 一类设备一张图片卡，用引导线指到地图上的安装位置。
 *
 * 图片从 buildingos_web 的素材里挑的实拍图，拷在 public/devices/ 下。
 * at 是地图上的百分比位置（拍脑袋摆的，Excel 里没有坐标）。
 */
const DEVICE_PHOTOS = [
  { name: '墙面屏', where: '电梯厅 · 走道墙面', image: '/devices/wall-screen.png', color: '#2f6fd0', at: [40, 30], side: 'left' },
  { name: '厕所屏', where: '卫生间入口', image: '/devices/toilet-screen.png', color: '#12a5a5', at: [28, 64], side: 'left' },
  { name: '开关屏', where: '会议室门口', image: '/devices/switch-screen.png', color: '#7a5cd0', at: [24, 46], side: 'left' },
  { name: '会议室场景', where: '各会议室', image: '/devices/meeting-pad.jpg', color: '#d99b26', at: [34, 74], side: 'left' },
  { name: '人体传感器', where: '办公区 · 走道顶面', image: '/devices/human-sensor.png', color: '#2e9e4f', at: [48, 38], side: 'right' },
  { name: '电量采集器', where: '楼层配电间', image: '/devices/power-collector.png', color: '#e36c0a', at: [64, 34], side: 'right' },
  { name: '照明开关', where: '房间门口', image: '/devices/light-switch.png', color: '#2f9fd0', at: [70, 52], side: 'right' },
  { name: '空调面板', where: '办公室 · 会议室', image: '/devices/ac-panel.jpg', color: '#1f5c94', at: [60, 68], side: 'right' },
];

const PHOTOS_PAGE = {
  id: 'device-photos',
  name: '1F 设备实拍与安装位置',
  view: 'overview',
  studio: true,
  camera: { position: [0, 156, 0.01], target: [0, 0, 0] },
  overlays: [{
    kind: 'device-photos',
    title: '1F 设备实拍与安装位置',
    subtitle: '8 类末端设备 · 图为准，位置示意',
    groups: DEVICE_PHOTOS,
  }],
  overrides: {
    layout: 'free-canvas',
    scene: { main: { provider: 'smart-floor-bg' } },
    views: canvasViews([], {
      id: 'overview',
      view: {
        title: '1F 设备实拍与安装位置',
        description: '墙面屏、厕所屏、开关屏、会议室面板、人体传感器、电量采集器、照明开关、空调面板。',
        metrics: [
          { label: '设备类型', value: '8 类' },
          { label: '楼层', value: '总部 1F' },
          { label: '呈现', value: '实拍 + 定位' },
        ],
      },
    }),
  },
};

/**
 * 智能场景（策略）实施效果 —— 左边我方已配置的策略，右边对标望潮同空间的策略规模。
 *
 * 数据来源：策略清单 sence-smart-0912.json（4 套、17 条规则、覆盖 96 处），
 * 对标数据：《【智控策略】对标望潮》00-总览与对标说明（10 套、2363 条规则、3524 处）。
 */
const STRATEGY_PAGE = {
  id: 'strategy',
  name: '智能场景（策略）实施效果',
  view: 'overview',
  studio: true,
  camera: { position: [0, 154, 0.01], target: [0, 0, 0] },
  overlays: [{
    kind: 'strategy-effect',
    title: '智能场景（策略）实施效果',
    subtitle: '策略数据源：sence-smart-0912.json · 对标数据源：【智控策略】对标望潮 2026-09-05',
    benchTitle: '对标其他空间策略 · 吉行园区 / 望潮 HGH-WC',
    totals: [
      { value: '4', label: '已配置策略（套）' },
      { value: '17', label: '执行规则（条）' },
      { value: '96', label: '覆盖空间（处）' },
    ],
    // 执行方式的分布：我方目前只有定时和人感两类规则
    kinds: [
      { label: '定时', count: 15 },
      { label: 'AI 人感', count: 2 },
      { label: '温控', count: 0 },
      { label: '告警', count: 0 },
    ],
    rows: [
      // detail 指向 mock 里的详情表，点这一行就弹出来
      { name: '总部大楼空调定时', kind: '空调 · 定时', actions: 9, color: '#2f6fd0', detail: 'strategy_1' },
      { name: '照明定时', kind: '照明 · 定时', actions: 4, color: '#d99b26', detail: 'strategy_3' },
      { name: '空调定时', kind: '空调 · 定时', actions: 2, color: '#2f9fd0', detail: 'strategy_0' },
      { name: '会议室照明策略', kind: '照明 · AI 人感', actions: 2, color: '#7a5cd0', detail: 'strategy_2' },
    ],
    sources: [
      { label: '我方 SMART', key: 'mine' },
      { label: '吉行园区', key: 'jixing', cls: 'jixing' },
      { label: '望潮 HGH-WC', key: 'theirs', cls: 'theirs' },
    ],
    // 吉行那一列来自《【智控策略】对标-吉行》台账：空调夏 10 套 + 冬 7 套、照明 11 套，
    // 规则数和覆盖空间台账里没有，用「—」而不是编一个数。它另有 33 条策略变更需求记录。
    benchmark: [
      { kind: '空调', mine: { sets: 2, rules: 11, spaces: 96 }, jixing: { sets: 17, rules: '—', spaces: '—' }, theirs: { sets: 5, rules: 1904, spaces: 2006 } },
      { kind: '照明', mine: { sets: 1, rules: 4, spaces: 17 }, jixing: { sets: 11, rules: '—', spaces: '—' }, theirs: { sets: 2, rules: 394, spaces: 604 } },
      { kind: 'AI 无人', mine: { sets: 1, rules: 2, spaces: 3 }, jixing: { sets: 0, rules: 0, spaces: 0 }, theirs: { sets: 2, rules: 43, spaces: 475 } },
      { kind: '温控告警', mine: { sets: 0, rules: 0, spaces: 0 }, jixing: { sets: 0, rules: 0, spaces: 0 }, theirs: { sets: 1, rules: 22, spaces: 439 } },
    ],
    // 24 小时时间轴用的排程：把策略里落在 1F 的规则映射到模型房间上。
    // 空调和照明分开，规则按时间排序，某时刻取「不晚于它」的最后一条。
    schedule: [
      {
        type: 'air', area: '总部大楼全楼（24 间）',
        ids: ['101', '102', '105', '106', '108', 'mother', 'finance', 'archive', '102-1', '102-2', '105-1', '105-2', '105-3', '105-5', '105-7', '106-1', '106-2', '106-3', '103', '104'],
        rules: [
          { t: '01:00', on: false },
          { t: '08:30', on: true, temp: 27 },
          { t: '18:00', on: false },
          { t: '21:30', on: false },
          { t: '23:00', on: false },
        ],
      },
      {
        type: 'air', area: '卫生间（4 间）',
        ids: ['wc-m', 'wc-w', 'wc-e1', 'wc-e2'],
        rules: [{ t: '09:00', on: true, temp: 26 }],
      },
      {
        type: 'light', area: '总部办公区（4 间）',
        ids: ['101', '102', '105', '106'],
        // 原策略只有「12:00 午休关 / 13:00 开」两条，缺头缺尾：
        //   没有每日关闭 → 按「沿用上一条」它会一直亮；
        //   没有早上开启 → 早上会沿用前一天的关灯状态，一直黑到 13:00。
        // 补两条：08:30 开（和空调用时对齐）、21:00 关（和公共区域照明对齐）。
        rules: [
          { t: '08:30', on: true },
          { t: '12:00', on: false },
          { t: '13:00', on: true },
          { t: '21:00', on: false },
        ],
      },
      {
        // 策略里的「公共区域」覆盖的是前台区、次门厅，模型里没有这两个房间，
        // 用电梯厅代表公共通行区，好让 17:00~21:00 这段开灯能看见。
        type: 'light', area: '公共区域（映射到电梯厅）',
        ids: ['lift'],
        rules: [
          { t: '17:00', on: true },
          { t: '21:00', on: false },
        ],
      },
    ],
    note: 'Smart 4 套策略、17 条规则，覆盖空间按策略累加 116 处、去重后 96 处；吉行园区台账 28 套（空调 17、照明 11），另有 33 条策略变更需求记录（2025.08 起）；望潮 10 套、2,363 条规则、3,524 处。差距集中在空调的季节档与温控告警，这两类我方尚未配置。',
  }],
  overrides: {
    layout: 'free-canvas',
    scene: { main: { provider: 'smart-floor-bg' } },
    views: canvasViews([], {
      id: 'overview',
      view: {
        title: '智能场景（策略）实施效果',
        description: 'Smart已配置 4 套策略，对标望潮 10 套；定时与人感已落地，温控与告警待建。',
        metrics: [
          { label: '策略', value: '4 套' },
          { label: '规则', value: '17 条' },
          { label: '覆盖', value: '96 处' },
        ],
      },
    }),
  },
};

/**
 * 下一步计划 —— 进入系统调优和持续集成阶段的四步。
 */
const NEXT_STEPS_PAGE = {
  id: 'next-steps',
  name: '下一步计划',
  view: 'overview',
  studio: true,
  camera: { position: [-165, 205, 295], target: [0, 6, -22] },
  overlays: [{
    kind: 'next-steps',
    title: '下一步计划',
    subtitle: '进入系统调优和持续集成阶段',
    steps: [
      '建立业务方、物业方、IT 方、供应商方四方的协作群',
      '确定 12 个场景的需求细节（标准功能复用 + 定制需求开发）',
      '细化智能策略',
      '继续集成第三方系统',
    ],
  }],
  overrides: {
    layout: 'free-canvas',
    views: canvasViews([], {
      id: 'overview',
      view: {
        title: '下一步计划',
        description: '从交付转向调优与持续集成，四件事并行推进。',
        metrics: [
          { label: '阶段', value: '系统调优' },
          { label: '重点', value: '持续集成' },
          { label: '步骤', value: '4 项' },
        ],
      },
    }),
  },
};

/**
 * 封底 —— 和 0 号页同一套版式，只有「谢谢」两个字。
 */
const CLOSING_PAGE = {
  id: 'closing',
  name: '谢谢',
  bare: true,
  view: 'overview',
  studio: true,
  camera: { position: [172, 168, 262], target: [0, 0, -23] },
  overlays: [{
    kind: 'cover',
    title: '谢谢',
    bullets: [],
  }],
  overrides: {
    layout: 'free-canvas',
    views: canvasViews([], {
      id: 'overview',
      view: {
        title: '谢谢',
        description: '汇报结束。',
        metrics: [
          { label: '汇报', value: '结束' },
          { label: '单元', value: '数字化共享中心' },
          { label: '日期', value: '2026.09' },
        ],
      },
    }),
  },
};

export default {
  id: 'jili-smart-deck',
  name: '吉利集团智慧园区 · 演示',
  description: 'Smart 模型 + 浅色主题 + 纯白背景，五页汇报。',
  mode: 'deck',

  site: 'smart',
  theme: 'light-orange',
  layout: 'three-column',
  // 整份演示默认都用纯白背景，个别页要场景背景再单独写 studio: false
  studio: true,

  slides: [
    // 0 号页：封页
    COVER_PAGE,
    page({
      id: 'summary',
      name: '项目概况介绍',
      view: 'overview',
      left: ['summary', 'overview', 'environment'],
      right: ['people', 'parking'],
      title: '项目概况介绍',
      description: '园区规模、建筑体量与人员车辆总体情况。',
      metrics: [
        { label: '规划建筑面积 / m²', value: '35,117' },
        { label: '工位', value: '约 1,500' },
        { label: '停车位 / 个', value: '347' },
      ],

      // 正面全景，跟模型自己的初始机位一致
      camera: { position: [105, 180, 280], target: [0, 0, -23] },
    }),
    // 第二页：项目执行计划时间轴
    TIMELINE_PAGE,
    // 第三页：那张战略地图
    frameworkPage,
    // 第四页：技术架构
    ARCHITECTURE_PAGE,
    // 第五页：智能化控制逻辑图（端到端网络拓扑）
    TOPOLOGY_PAGE,
    // 第六页：空调设备分布（1F 地图 + 分项统计）
    DEVICE_PAGE,
    // 第七页：1F 设备实拍与安装位置
    PHOTOS_PAGE,
    // 第八页：12 个场景围着模型，点开是对标表
    scenarioPage,
    // 第九页：智能场景（策略）实施效果
    STRATEGY_PAGE,
    // 第十页：下一步计划
    NEXT_STEPS_PAGE,
    // 第十一页：封底
    CLOSING_PAGE,
  ],
};
