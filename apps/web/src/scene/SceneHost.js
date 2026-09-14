/**
 * 把场景模型包成统一的句柄。
 *
 * 做两件事：
 * 1. 提供者只声明自己支持哪些能力（capabilities）。没声明的方法调用不会报错，
 *    UI 用 can('explodeFloor') 判断，而不是去问「当前是哪个园区」。
 * 2. 原来那种一个个回调（onLabels / onStats / ...）统一换成事件订阅，
 *    UI 用 on('labels', fn) 接收。
 */
const RESERVED = ['provider', 'capabilities', 'can', 'on', 'dispose'];

export function createSceneHost(provider, container, context = {}) {
  if (!provider || typeof provider.create !== 'function') {
    throw new Error('场景模型「' + (provider && provider.id) + '」没有 create 方法');
  }

  const listeners = new Map();
  function emit(type, payload) {
    const set = listeners.get(type);
    if (set) set.forEach(fn => fn(payload));
  }

  const raw = provider.create(container, { ...context, emit }) || {};
  const capabilities = new Set(provider.capabilities || []);

  const host = {
    provider,
    capabilities,
    can(capability) { return capabilities.has(capability); },
  };

  for (const capability of capabilities) {
    if (RESERVED.includes(capability)) continue;
    host[capability] = (...args) => {
      const fn = raw[capability];
      return typeof fn === 'function' ? fn(...args) : undefined;
    };
  }

  host.on = (type, fn) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
    return () => listeners.get(type)?.delete(fn);
  };

  host.dispose = () => {
    listeners.clear();
    if (typeof raw.dispose === 'function') raw.dispose();
  };

  return host;
}
