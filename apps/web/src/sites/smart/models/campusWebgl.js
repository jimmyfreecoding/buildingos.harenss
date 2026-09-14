import { createSmartCampus } from '../../../scene/createSmartCampus.js';

/**
 * Smart 园区的本地 WebGL 模型。
 *
 * 注意两处和吉行不一样，这里保持原样，不要在 P1 顺手「统一」：
 * 1. 建模函数没有 explodeFloor / closeFloor，楼层炸开只弹室内视图；
 * 2. 点楼栋时建模函数直接调 focus()，不发 select 事件，所以不会弹出楼栋详情卡。
 */
export default {
  id: 'smart-webgl',
  label: 'Smart · WebGL 程序化模型',
  kind: 'webgl',
  capabilities: [
    'environment', 'focus', 'reset', 'top', 'orbit', 'pause', 'snapshots',
    'labels', 'studio', 'view',
  ],
  create(container, context = {}) {
    const emit = context.emit || (() => {});
    // 主题里的场景调色板就是「模型渲染色板」
    const palette = context.theme && context.theme.scene;
    return createSmartCampus(container, {
      onLabels: value => emit('labels', value),
      onStats: value => emit('stats', value),
      onSnapshots: value => emit('snapshots', value),
    }, { palette });
  },
};
