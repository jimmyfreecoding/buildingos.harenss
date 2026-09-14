import { readJson, writeJson, removeKey } from './storage.js';

/**
 * 演示模式里「自由摆放」的那一份布局草稿。
 *
 * 一页的草稿长这样：
 *   { list: ['overview', 'people'], cards: { overview: { type: 'overview', box: { x, y, w, h } } } }
 *
 * box 是百分比（相对画布区域），所以换个分辨率不会散。
 * 和「保存视角」一样，草稿盖在项目文件上面，要固化就点「复制代码」贴回 project.js。
 */
const KEY = 'ioc:deck-layouts:';
const key = projectId => KEY + projectId;
const round = value => Math.round(Number(value) * 10) / 10;

export function readDeckLayouts(projectId) {
  const value = readJson(key(projectId), null);
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function saveDeckLayout(projectId, slideId, layout) {
  const all = readDeckLayouts(projectId);
  all[slideId] = layout;
  writeJson(key(projectId), all);
  return all;
}

export function clearDeckLayout(projectId, slideId) {
  const all = readDeckLayouts(projectId);
  delete all[slideId];
  if (Object.keys(all).length) writeJson(key(projectId), all);
  else removeKey(key(projectId));
  return all;
}

/**
 * 从三栏的左右两栏推出一套初始摆放。
 *
 * 注意是**每个态势都要推**，不是只推当前那个：布局是整页的属性，
 * 换画布以后所有态势用的区域都得是 canvas，否则剩下的态势还挂着 left / right，
 * 校验会直接说「布局里不存在的区域」。
 *
 * 同一张卡在多个态势里出现时只摆一次，位置共用。
 */
export function deriveCanvas(views) {
  const lists = {};
  const cards = {};
  const place = (ids, x) => {
    const items = (ids || []).filter(id => typeof id === 'string' && id);
    if (!items.length) return [];
    const gap = 1.5;
    const height = (100 - gap * (items.length - 1)) / items.length;
    items.forEach((id, i) => {
      if (!cards[id]) cards[id] = { type: id, box: { x, y: round(i * (height + gap)), w: 23, h: round(height) } };
    });
    return items.slice();
  };
  for (const view of views || []) {
    if (!view || !view.id) continue;
    const regions = view.regions || {};
    if (Array.isArray(regions.canvas) && regions.canvas.length) {
      lists[view.id] = regions.canvas.slice();
      regions.canvas.forEach((id, i) => {
        if (!cards[id]) cards[id] = { type: id, box: { x: 30, y: 5 + (i % 3) * 31, w: 26, h: 28 } };
      });
      continue;
    }
    lists[view.id] = [...place(regions.left, 1.5), ...place(regions.right, 75.5)];
  }
  return { lists, cards };
}

/** 新加的卡放在中间那条空着的地方，免得一上来就压在已有的卡上。 */
export function nextCardBox(existingCount) {
  return { x: 30, y: 5 + (existingCount % 3) * 31, w: 26, h: 28 };
}

/** 同名实例已经用过就往后排：energy -> energy$2 -> energy$3 */
export function nextInstanceId(type, used) {
  if (!used.includes(type)) return type;
  let n = 2;
  while (used.includes(type + '$' + n)) n++;
  return type + '$' + n;
}

/**
 * 生成可以贴回 project.js 的片段。给的是整段 overrides，
 * 直接替换这一页原来的 overrides 就行，不用自己拼。
 */
export function deckLayoutSnippet(overrides) {
  const body = JSON.stringify(overrides, null, 2);
  return 'overrides: ' + body.split('\n').map((line, i) => (i === 0 ? line : '  ' + line)).join('\n') + ',';
}
