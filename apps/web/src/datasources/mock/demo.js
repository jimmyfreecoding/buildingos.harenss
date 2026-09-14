import { SLOT_IDS } from '../slots.js';

/**
 * 演示数据源：直接读园区文件里写死的 data（sites/<id>/data/mock.js）。
 *
 * query 故意返回普通值而不是 Promise，这样首屏是同步的、不会闪一下空白。
 * 真实数据源（REST / MQTT）返回 Promise 也可以，dataContext 两种都认。
 */
export default {
  id: 'demo-mock',
  label: '演示数据（写死在园区文件里）',
  kind: 'mock',
  slots: SLOT_IDS,
  query(slot, params, context) {
    const site = context && context.site;
    const data = site && site.data;
    if (!data) throw new Error('园区「' + (site ? site.id : '?') + '」没有配演示数据');
    if (!(slot in data)) throw new Error('演示数据里没有数据槽「' + slot + '」');
    const value = data[slot];
    // 槽的值可以直接是数据，也可以是「按参数算出来」的函数
    return typeof value === 'function' ? value(params || {}) : value;
  },
};
