import { computed, inject, provide, ref } from 'vue';

export const DATA_CONTEXT = Symbol('ioc-data');

/**
 * 数据容器。
 *
 * 卡片说「我要 kpi.overview」，容器去找一个声明了该数据槽的数据源要值。
 * 返回值是普通值就是同步的，返回 Promise 就自动按异步处理。
 *
 * 缓存故意不用 reactive：read() 会在 computed 里被调用，如果顺手往响应式对象里
 * 写东西，computed 会自己把自己弄脏。异步源用 load() 加载完再自增 version，
 * 由 useDataSlot 监听 version 来重算。
 */
export function createDataContext({ site, registries }) {
  const sources = [];
  const cache = {};
  const version = ref(0);
  const context = { site, registries };

  function pickSource(slot) {
    return sources.find(source => !source.slots || source.slots.includes(slot)) || null;
  }

  function keyOf(slot, params) {
    return params ? slot + '|' + JSON.stringify(params) : slot;
  }

  /** 同步读。数据源是同步的时候拿得到值，异步源第一次会拿到 undefined。 */
  function read(slot, params) {
    const key = keyOf(slot, params);
    if (key in cache) return cache[key];
    const source = pickSource(slot);
    if (!source) {
      cache[key] = undefined;
      return undefined;
    }
    const result = source.query(slot, params || {}, context);
    if (result && typeof result.then === 'function') {
      cache[key] = undefined;
      result.then(value => { cache[key] = value; version.value++; })
            .catch(() => { /* 失败就保持 undefined，由 state() 报错 */ });
      return undefined;
    }
    cache[key] = result;
    return result;
  }

  /** 异步加载一个槽，加载完触发依赖它的 computed 重算。 */
  async function load(slot, params) {
    const source = pickSource(slot);
    if (!source) throw new Error('没有数据源提供「' + slot + '」');
    const value = await source.query(slot, params || {}, context);
    cache[keyOf(slot, params)] = value;
    version.value++;
    return value;
  }

  function reset() {
    for (const key of Object.keys(cache)) delete cache[key];
    version.value++;
  }

  /** 换园区：把数据源换成这个园区配置的那一个，并清空缓存。 */
  function useSite(nextSite) {
    context.site = nextSite;
    sources.length = 0;
    const id = nextSite && nextSite.defaultDataSource;
    const source = id ? registries.dataSources.get(id) : null;
    if (source) sources.push(source);
    reset();
  }

  function dispose() {
    sources.forEach(source => { if (source.dispose) source.dispose(); });
    reset();
  }

  useSite(site);
  return { sources, version, read, load, reset, useSite, dispose, context };
}

export function provideDataContext(dataContext) {
  provide(DATA_CONTEXT, dataContext);
  return dataContext;
}

export function useDataContext() {
  const dataContext = inject(DATA_CONTEXT, null);
  if (!dataContext) throw new Error('这里拿不到数据容器：外层缺少 provideDataContext');
  return dataContext;
}

/**
 * 卡片里这样用：const alarms = useDataSlot('alarm.list')
 *
 * params 可以传函数，里面的响应式依赖变了就会重新取数；
 * fallback 是取不到数据时的兜底，免得模板里到处判空。
 */
export function useDataSlot(slot, params, fallback) {
  const dataContext = useDataContext();
  return computed(() => {
    // 读一下版本号：异步数据源加载完会自增，触发这里重算
    dataContext.version.value;
    const resolved = typeof params === 'function' ? params() : params;
    const value = dataContext.read(slot, resolved);
    return value === undefined ? fallback : value;
  });
}
