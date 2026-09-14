/**
 * 吉行 · 演示文稿。
 *
 * 每一页都是一份 IOC 配置——和在搭建页里配出来的是同一套东西，
 * 只是这里按顺序排成一叠。翻页时大屏会按该页的配置重排。
 */
const slide = (id, name, view, extra) => ({
  id,
  name,
  view,
  studio: true,          // 默认用纯白背景，适合放到 PPT 里
  ...extra,
});

export default {
  id: 'jixing-deck',
  name: '吉行 · 演示文稿',
  description: '白底模型 + 逐页态势，左右键翻页。',
  mode: 'deck',

  site: 'jixing',
  theme: 'light-orange',
  layout: 'three-column',

  slides: [
    slide('overview', '园区总览', 'overview'),
    slide('security', '安防态势', 'security'),
    slide('energy', '能耗态势', 'energy'),
    slide('traffic', '通行态势', 'traffic'),
    slide('devices', '设备态势', 'devices'),
    // 同一份配置换个主题就是另一页
    slide('space-dark', '空间态势 · 深色', 'space', { theme: 'dark-cyan', studio: false }),
    slide('overview-gold', '园区总览 · 石墨金', 'overview', { theme: 'graphite-gold' }),
  ],
};
