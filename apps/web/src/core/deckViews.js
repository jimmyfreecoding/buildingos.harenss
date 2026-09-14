import { readJson, writeJson, removeKey } from './storage.js';

/**
 * 演示模式里「拖好之后保存」的那一份视角。
 *
 * 每页的相机位置按项目存在浏览器里，key 是 ioc:deck-views:<项目 id>。
 * 它盖在项目文件里写的 camera 上面 —— 因为保存是刚刚动手做的事，
 * 比文件里的旧值新。想回到文件里的值就点「还原」。
 *
 * 这个仓库没有后端，所以这里存的是本地草稿；要让改动真正进版本库，
 * 演示模式上有「复制代码」，把片段贴回 project.js 就行。
 */
const KEY = 'ioc:deck-views:';
const key = projectId => KEY + projectId;

export function readDeckViews(projectId) {
  const value = readJson(key(projectId), null);
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function saveDeckView(projectId, slideId, view) {
  const all = readDeckViews(projectId);
  all[slideId] = view;
  writeJson(key(projectId), all);
  return all;
}

export function clearDeckView(projectId, slideId) {
  const all = readDeckViews(projectId);
  delete all[slideId];
  if (Object.keys(all).length) writeJson(key(projectId), all);
  else removeKey(key(projectId));
  return all;
}

/** 四舍五入到一位小数，免得复制出来是一串 104.99999999。 */
function round(list) {
  return list.map(n => Math.round(Number(n) * 10) / 10);
}

/**
 * 生成可以贴回 project.js 的片段。粘到某一页的对象里就行。
 *
 *   { id: 'summary', name: '项目概况介绍', view: 'overview',
 *     camera: { position: [105, 180, 280], target: [0, 0, -23] } }
 */
export function deckViewSnippet(view) {
  if (!view || !Array.isArray(view.position)) return '';
  const position = round(view.position);
  const target = Array.isArray(view.target) ? round(view.target) : [0, 0, 0];
  return 'camera: { position: [' + position.join(', ') + '], target: [' + target.join(', ') + '] },';
}
