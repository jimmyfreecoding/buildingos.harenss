/** 把 /views/0/regions/left 这样的路径拆成 ['views','0','regions','left'] */
export function parsePointer(pointer) {
  if (pointer === '' || pointer === '/') return [];
  if (typeof pointer !== 'string' || pointer[0] !== '/') {
    throw new Error('路径必须以 / 开头，收到的是「' + pointer + '」');
  }
  return pointer
    .slice(1)
    .split('/')
    .map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pathOf(segments) {
  return '/' + segments.join('/');
}

function readParent(target, segments) {
  let node = target;
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i];
    if (node === null || typeof node !== 'object') {
      throw new Error('路径走不通：到不了「' + pathOf(segments.slice(0, i)) + '」');
    }
    node = node[key];
  }
  return node;
}

function readValue(target, segments) {
  let node = target;
  for (const key of segments) {
    if (node === null || typeof node !== 'object' || !(key in node)) {
      throw new Error('路径不存在：' + pathOf(segments));
    }
    node = node[key];
  }
  return node;
}

function addAt(target, segments, value) {
  const key = segments[segments.length - 1];
  const parent = readParent(target, segments);
  if (Array.isArray(parent)) {
    if (key === '-') { parent.push(value); return; }
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index > parent.length) {
      throw new Error('数组下标不合法：' + key);
    }
    parent.splice(index, 0, value);
    return;
  }
  if (parent === null || typeof parent !== 'object') {
    throw new Error('不能在「' + pathOf(segments) + '」上添加内容');
  }
  parent[key] = value;
}

function removeAt(target, segments) {
  const key = segments[segments.length - 1];
  const parent = readParent(target, segments);
  if (Array.isArray(parent)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= parent.length) {
      throw new Error('数组下标不合法：' + key);
    }
    parent.splice(index, 1);
    return;
  }
  if (parent === null || typeof parent !== 'object' || !(key in parent)) {
    throw new Error('路径不存在：' + pathOf(segments));
  }
  delete parent[key];
}

/**
 * 按顺序执行改动，返回一份新配置，原来的对象不动。
 * 支持 add / remove / replace / move 四种操作。
 */
export function applyPatch(target, ops) {
  if (!Array.isArray(ops)) throw new Error('改动必须是一个数组');
  const next = clone(target);

  for (const op of ops) {
    if (!op || typeof op.op !== 'string' || typeof op.path !== 'string') {
      throw new Error('每一项改动都要有 op 和 path');
    }
    const segments = parsePointer(op.path);
    if (!segments.length) throw new Error('不允许整体替换配置');

    if (op.op === 'add') { addAt(next, segments, clone(op.value)); continue; }
    if (op.op === 'replace') { removeAt(next, segments); addAt(next, segments, clone(op.value)); continue; }
    if (op.op === 'remove') { removeAt(next, segments); continue; }
    if (op.op === 'move') {
      if (typeof op.from !== 'string') throw new Error('move 需要 from');
      const fromSegments = parsePointer(op.from);
      const value = clone(readValue(next, fromSegments));
      removeAt(next, fromSegments);
      addAt(next, segments, value);
      continue;
    }
    throw new Error('不认识的操作：' + op.op);
  }

  return next;
}

function describeOne(op, cardName, regionName, viewName) {
  const segments = parsePointer(op.path);
  if (segments[0] === 'site') return '园区改为「' + op.value + '」';
  if (segments[0] === 'theme') return '主题改为「' + op.value + '」';
  if (segments[0] === 'layout') return '布局改为「' + op.value + '」';
  if (segments[0] === 'scene') return '场景模型有改动';
  if (segments[0] === 'cards') {
    if (op.op === 'add') return '新增卡片「' + cardName(op.value && op.value.type) + '」';
    if (op.op === 'remove') return '移除卡片实例「' + segments[1] + '」';
    return '修改了卡片实例「' + segments[1] + '」';
  }
  if (segments[0] === 'views' && segments[2] === 'regions') {
    const cards = (op.value || []).map(cardName).join('、');
    return '态势「' + viewName(segments[1]) + '」的「' + regionName(segments[3]) + '」区域改为：' + cards;
  }
  return '修改了 ' + op.path;
}

/**
 * 把改动翻译成人话，给用户确认时看。
 * names = { card: id => 显示名, region: id => 显示名 }
 */
export function describePatch(ops, names = {}) {
  const cardName = names.card || (id => id);
  const regionName = names.region || (id => id);
  const viewName = names.view || (id => '#' + id);
  return ops.map(op => describeOne(op, cardName, regionName, viewName));
}
