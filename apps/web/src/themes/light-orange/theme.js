import skin from './skin.js';

/**
 * 浅色模板（参考冷链物流可视化那套）。
 *
 * 跟深色那套的差别不只是配色：深色的面板是半透明浮在三维场景上的，
 * 这套是白底圆角卡片摆在一块浅灰画布上。这种形状上的差别 tokens 表达不了，
 * 所以额外带一张 skin.css。
 */
export default {
  id: 'light-orange',
  name: '浅色 · 橙',
  skin,

  tokens: {
    '--ioc-bg': '#eef1f4',
    '--ioc-text': '#1f2329',
    '--ioc-text-muted': '#8a9099',
    '--ioc-text-dim': '#646a73',

    '--ioc-header-1': '#ffffff',
    '--ioc-header-2': '#ffffff',
    '--ioc-header-3': '#ffffff',
    '--ioc-header-line': '#e9ecef',
    '--ioc-header-shadow': '#10182814',

    '--ioc-footer-bg': '#ffffff',
    '--ioc-footer-line': '#e9ecef',
    '--ioc-footer-text': '#646a73',

    '--ioc-card-1': '#ffffff',
    '--ioc-card-2': '#ffffff',
    '--ioc-card-line': '#e9ecef',
    '--ioc-card-shadow': '#10182814',
    '--ioc-card-text': '#1f2329',

    '--ioc-tool-bg': '#ffffff',
    '--ioc-tool-line': '#e9ecef',
    '--ioc-tool-hover': '#f2f4f7',
    '--ioc-tool-active-bg': '#fff3e8',
    '--ioc-tool-active-line': '#fdba74',
    '--ioc-tool-active-text': '#f97316',

    '--ioc-accent': '#f97316',
    '--ioc-accent-soft': '#fdba74',
    '--ioc-success': '#22c55e',
    '--ioc-warning': '#f59e0b',
    '--ioc-danger': '#ef4444',
    '--ioc-info': '#14b8a6',

    '--ioc-panel-head-line': '#eef0f2',
    '--ioc-panel-head-1': '#ffffff',
    '--ioc-panel-head-2': '#ffffff',
    '--ioc-panel-head-text': '#1f2329',
    '--ioc-panel-head-accent-1': '#f97316',
    '--ioc-panel-head-accent-2': '#fdba7480',
    '--ioc-panel-head-glow': '#f9731600',
    '--ioc-panel-head-sub': '#a3a8b0',

    '--ioc-nav-active-text': '#f97316',
    '--ioc-nav-active-glow': '#f9731600',
    '--ioc-nav-underline': '#f97316',
    '--ioc-nav-underline-glow': '#f9731600',
    '--ioc-nav-tab-from': '#fff3e8',
    '--ioc-nav-tab-to': '#fff3e800',
    '--ioc-nav-tab-line': '#fdba74',
    '--ioc-nav-hover-bg': '#f2f4f7',

    '--ioc-panel-corner': '#f9731640',
    '--ioc-metric-text': '#1f2329',
    '--ioc-metric-label': '#646a73',
    '--ioc-toolbar-1': '#ffffff',
    '--ioc-toolbar-2': '#ffffff',
    '--ioc-toolbar-line': '#e9ecef',

    '--ioc-chart-grid': '#dfe3e8',
    '--ioc-chart-text': '#8a9099',
    '--ioc-plan-bg': '#f7f9fb',
    '--ioc-plan-line': '#c9d1d9',
  },

  charts: {
    palette: ['#f97316', '#14b8a6', '#60a5fa', '#f59e0b'],
    // 浅色模板要换成自己的曲线配色；默认那套保持数据里写的颜色不动
    overrideSeries: true,
  },

  scene: {
    concrete: 0xe9edf0,
    curb: 0xeef1f4,
    asphalt: 0xc6ccd2,
    dark: 0x9aa3ab,
    white: 0xf7f9fa,
    lawn: 0xa9c298,
    soil: 0xdde1e4,
    wood: 0xd9c3a6,
    metal: 0xc2c9cf,
    trim: 0xe4e9ed,
    glass: 0xeef2f5,
    glassNight: 0xb9c4cd,
    podiumGlass: 0xe8edf1,
    silver: 0xe2e7eb,
    frame: 0xdde3e8,
    road: 0xbfc6cc,
    green: 0xa9c298,
    water: 0x7fb6c8,
    sun: 0xfff3e0,
    sunDusk: 0xffc79a,
    sunNight: 0xa8c0dc,
    fogDay: 0xdfe6ec,
    fogDusk: 0xe6d8cc,
    fogNight: 0x2a3340,
    facadeBase: '#eef2f5',
    facadeNightBase: '#8d98a2',
    facadeLit: '#ffd9a0',
    facadeOff: '#5b6570',
    facadeMullion: 'rgba(255,255,255,.85)',
    facadeShadow: 'rgba(150,162,172,.26)',
    facadeWindow: [226, 232, 237],
    facadeWindowRange: [22, 20, 18],
    envSkyTop: '#cfdde8',
    envSkyMid: '#e4edf3',
    envSkyLow: '#f2f5f7',
    envGround: '#c3c9c4',
    // 「纯白背景」开关用的两个颜色
    studioSky: 0xffffff,
    studioGround: 0xffffff,
    // 白底模式下场地材质朝白色靠的强度，1 就是全白
    studioWash: .96,
    ground: 0xffffff,
    skyDay: 0xdfe9f2,
    skyNight: 0x1b2430,
  },
};
