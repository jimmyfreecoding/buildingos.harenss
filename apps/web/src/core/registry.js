/**
 * 通用清单。
 *
 * 园区、场景模型、卡片、布局、主题、数据源都用同一套注册和查找逻辑。
 * 目的是让上层只通过「名字」拿到实现，而不是 import 具体文件 —— 这样
 * 加一个新园区不需要改页面代码，AI 也只需要产出名字。
 */

export function createRegistry(kind, options = {}) {
  // 大多数清单用 id 当名字，卡片用 type
  const idField = options.idField || 'id';
  const items = new Map();

  function register(definition) {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      throw new TypeError(kind + '：注册项必须是一个对象');
    }
    const id = definition[idField];
    if (typeof id !== 'string' || id === '') {
      throw new TypeError(kind + '：注册项缺少字符串 ' + idField);
    }
    if (items.has(id)) {
      throw new Error(kind + '：名字「' + id + '」已经注册过了');
    }
    items.set(id, definition);
    return definition;
  }

  function registerAll(list) {
    if (!Array.isArray(list)) throw new TypeError(kind + '：registerAll 需要一个数组');
    return list.map(register);
  }

  return {
    kind,
    register,
    registerAll,
    get(id) { return items.get(id); },
    has(id) { return items.has(id); },
    list() { return Array.from(items.values()); },
    ids() { return Array.from(items.keys()); },
    size() { return items.size; },
    clear() { items.clear(); },
  };
}
