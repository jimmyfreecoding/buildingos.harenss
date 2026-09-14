/**
 * 经典三栏布局。
 *
 * 只描述「屏幕分成哪几块」以及每块的角色，不描述放什么卡 ——
 * 放什么卡由当前态势的 regions 决定（见 sites/<id>/views.js）。
 */
export default {
  id: 'three-column',
  name: '经典三栏',
  regions: [
    { id: 'left', role: 'stack', side: 'left', label: '园区概况' },
    { id: 'right', role: 'stack', side: 'right', label: '运营统计' },
    { id: 'stage', role: 'scene' },
    { id: 'float', role: 'float' },
  ],
};
