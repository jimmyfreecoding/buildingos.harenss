/**
 * 深蓝科技主题。
 *
 * 两部分：
 * - tokens：界面用的 CSS 变量，挂到 .ioc-shell 上
 * - scene：三维模型的配色，传给场景模型提供者
 *
 * token 的默认值刻意和改造前 ioc.css 里的字面量一模一样，
 * 所以换用主题机制之后默认外观不变（scripts/style-dump-ioc.mjs 可以验证）。
 */
export default {
  id: 'dark-cyan',
  name: '深蓝科技',

  tokens: {
    // 外壳与文字
    '--ioc-bg': '#829db3',
    '--ioc-text': '#e7f3ff',
    '--ioc-text-muted': '#93aabe',
    '--ioc-text-dim': '#a2bccb',

    // 顶栏
    '--ioc-header-1': '#0b2037f2',
    '--ioc-header-2': '#102c47e3',
    '--ioc-header-3': '#1c416bbd',
    '--ioc-header-line': '#8ac9f067',
    '--ioc-header-shadow': '#081b3840',

    // 底栏
    '--ioc-footer-bg': '#0c2237ba',
    '--ioc-footer-line': '#a7c7e323',
    '--ioc-footer-text': '#9fb9cf',

    // 卡片与浮层
    '--ioc-card-1': '#173a53ed',
    '--ioc-card-2': '#10273bde',
    '--ioc-card-line': '#aad8ff55',
    '--ioc-card-shadow': '#10263b30',
    '--ioc-card-text': '#f1f8fe',

    // 工具条与按钮
    '--ioc-tool-bg': '#18334ac9',
    '--ioc-tool-line': '#b6dcff47',
    '--ioc-tool-hover': '#4486bca8',
    '--ioc-tool-active-bg': '#3574a4ad',
    '--ioc-tool-active-line': '#a1ddff80',
    '--ioc-tool-active-text': '#8ddbff',

    // 强调色与状态色
    '--ioc-accent': '#77d8ff',
    '--ioc-accent-soft': '#c3e6ff',
    '--ioc-success': '#85e5b2',
    '--ioc-warning': '#ffcf87',
    '--ioc-danger': '#ff947b',
    '--ioc-info': '#a8d6ff',

    // 顶部导航当前项
    '--ioc-nav-active-text': '#f3fbff',
    '--ioc-nav-active-glow': '#9bdaff',
    '--ioc-nav-underline': '#b8e6ff',
    '--ioc-nav-underline-glow': '#8cceff',
    '--ioc-nav-tab-from': '#6298ce53',
    '--ioc-nav-tab-to': '#5fa0de8c',
    '--ioc-nav-tab-line': '#98d4ff60',
    '--ioc-nav-hover-bg': '#a9d9ff10',
    // 面板装饰角 / 指标文字 / 底部工具条
    '--ioc-panel-corner': '#c6e6ff73',
    '--ioc-metric-text': '#dceeff',
    '--ioc-metric-label': '#bacddd',
    '--ioc-toolbar-1': '#243f55e8',
    '--ioc-toolbar-2': '#102c42eb',
    '--ioc-toolbar-line': '#b8dbf659',

    // 面板标题条
    '--ioc-panel-head-line': '#b8d6ee70',
    '--ioc-panel-head-1': '#4c86b647',
    '--ioc-panel-head-2': '#385d8200',
    '--ioc-panel-head-text': '#d8edff',
    '--ioc-panel-head-accent-1': '#a9d6ff',
    '--ioc-panel-head-accent-2': '#9fcdf177',
    '--ioc-panel-head-glow': '#8bd8ff7a',
    '--ioc-panel-head-sub': '#adcae07a',

    // 图表
    '--ioc-chart-grid': '#bed9ef',
    '--ioc-chart-text': '#a4bdd2',

    // 平面图
    '--ioc-plan-bg': '#0a2035',
    '--ioc-plan-line': '#9fd0ef',
  },

  charts: {
    palette: ['#94d3ff', '#fc9b84', '#7de6aa', '#b4d5ff'],
  },

  scene: {
    concrete: 0xb9bcba,
    curb: 0xd2d0c8,
    asphalt: 0x414a50,
    dark: 0x222c36,
    white: 0xdce4e7,
    lawn: 0x587340,
    soil: 0x384632,
    wood: 0x9a7960,
    metal: 0x536371,
    trim: 0xb1bcc4,
    glass: 0xb2c2cf,
    glassNight: 0x66758b,
    podiumGlass: 0xc3c9ce,
    silver: 0xcbd3d8,
    frame: 0xa9c1cc,
    road: 0x343f49,
    green: 0x547249,
    water: 0x528e9c,
    sun: 0xffefd2,
    sunDusk: 0xffaf69,
    sunNight: 0x8dbaff,
    fogDay: 0x9fb8ce,
    fogDusk: 0xb7a6a2,
    fogNight: 0x0c172b,
    // 外立面 canvas 贴图（不写就用建模函数里的原值，深色主题保持不动）
    facadeBase: '#5c7788',
    facadeNightBase: '#050608',
    facadeLit: '#efd8a0',
    facadeOff: '#020304',
    facadeMullion: 'rgba(184,207,218,.44)',
    facadeShadow: 'rgba(15,29,38,.6)',
    facadeWindow: [39, 57, 70],
    facadeWindowRange: [27, 30, 34],
    envSkyTop: '#688cba',
    envSkyMid: '#a5c3d7',
    envSkyLow: '#dae0df',
    envGround: '#697168',
    // 「纯白背景」开关用的两个颜色
    studioSky: 0xffffff,
    studioGround: 0xffffff,
    studioWash: .94,
    ground: 0x8c9991,
    skyDay: 0xa8c6dc,
    skyNight: 0x091525,
  },
};
