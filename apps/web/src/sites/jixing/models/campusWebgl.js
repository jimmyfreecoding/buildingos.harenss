import { createCampus } from '../../../scene/createCampus.js';

/**
 * 吉行园区的本地 WebGL 模型。
 *
 * capabilities 是 UI 判断「这个模型能不能做某件事」的唯一依据。
 * 页面里不再出现 modelId === 'jixing' 这种判断。
 */
export default {
  id: 'jixing-webgl',
  label: '吉行 · WebGL 程序化模型',
  kind: 'webgl',
  capabilities: [
    'environment', 'focus', 'reset', 'top', 'orbit', 'pause', 'snapshots',
    'labels', 'select', 'explodeFloor', 'closeFloor', 'studio', 'view',
  ],
  create(container, context = {}) {
    const emit = context.emit || (() => {});
    // 主题里的场景调色板就是「模型渲染色板」
    const palette = context.theme && context.theme.scene;
    return createCampus(container, {
      onLabels: value => emit('labels', value),
      onStats: value => emit('stats', value),
      onSelect: value => emit('select', value),
      onSnapshots: value => emit('snapshots', value),
    }, { palette });
  },
};
