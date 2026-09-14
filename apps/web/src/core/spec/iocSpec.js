export const SPEC_VERSION = 1;

/** 一份空白配置。所有字段在这里给默认值，后面只做覆盖。 */
export function emptySpec() {
  return {
    version: SPEC_VERSION,
    id: '',
    name: '',
    site: '',
    scene: { main: { provider: '', options: {} }, overlays: [], fallback: null },
    dataSources: [],
    theme: '',
    layout: '',
    navigation: { type: 'tabs', position: 'header', active: '' },
    views: [],
    cards: {},
    chrome: {
      header: { brand: true, nav: true, clock: true, weather: true, modelSwitch: true },
      footer: { hint: true, note: true },
      tools: [],
    },
    params: {},
  };
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** 深合并：数组整体替换，对象逐层合并。 */
export function mergeSpec(base, patch) {
  if (!isPlainObject(patch)) return clone(base);
  const out = clone(base);
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    out[key] = isPlainObject(value) && isPlainObject(out[key])
      ? mergeSpec(out[key], value)
      : (Array.isArray(value) ? value.slice() : value);
  }
  return out;
}

/**
 * 态势按 id 合并，而不是整段替换。
 *
 * 这样「只写某个态势的改动」不会把别的态势删掉，分享链接里也就只带改过的那几个。
 *
 * 但 regions 是整段替换的：区域集合是布局定的，从三栏换成自由画布时
 * 上一个布局的 left / right 会被逐区域合并留下来，校验就会说「布局里没有的区域」。
 */
function mergeViews(base, patch) {
  const byId = new Map((base || []).map(view => [view.id, clone(view)]));
  for (const view of patch) {
    if (!isPlainObject(view) || !view.id) continue;
    const before = byId.get(view.id);
    const merged = isPlainObject(before) ? mergeSpec(before, view) : clone(view);
    if (isPlainObject(view.regions)) merged.regions = clone(view.regions);
    byId.set(view.id, merged);
  }
  const order = (base || []).map(view => view.id);
  for (const view of patch) {
    if (view && view.id && !order.includes(view.id)) order.push(view.id);
  }
  return order.map(id => byId.get(id)).filter(Boolean);
}

function siteDefaults(site) {
  if (!site) return {};
  return {
    site: site.id,
    name: site.name,
    scene: { main: { provider: site.defaultScene || '', options: {} } },
    dataSources: site.defaultDataSource ? [site.defaultDataSource] : [],
    theme: site.defaultTheme || '',
    layout: site.defaultLayout || '',
    navigation: { type: 'tabs', position: 'header', active: site.defaultView || '' },
    views: site.views ? clone(site.views) : [],
  };
}

/**
 * 合成一份完整配置，顺序是：
 * 空白默认值 -> 园区默认值 -> 预设 -> 用户给的值。
 * 用户没写的地方用园区的默认值。
 */
export function normalizeSpec(input, site, preset) {
  let merged = emptySpec();
  merged = mergeSpec(merged, siteDefaults(site));
  if (preset) merged = mergeSpec(merged, preset);
  if (input) {
    const inputViews = input.views;
    merged = mergeSpec(merged, { ...input, views: undefined });
    if (Array.isArray(inputViews)) merged.views = mergeViews(merged.views, inputViews);
  }
  merged.version = SPEC_VERSION;
  if (!merged.views.length && site && Array.isArray(site.views)) merged.views = clone(site.views);
  if (!merged.navigation.active && merged.views.length) merged.navigation.active = merged.views[0].id;
  return merged;
}

export function findView(spec, viewId) {
  return (spec.views || []).find(view => view.id === viewId) || null;
}

/** 某个态势下某个区域要放的卡片实例名列表。 */
export function regionCards(spec, viewId, regionId) {
  const view = findView(spec, viewId);
  const list = view && view.regions ? view.regions[regionId] : null;
  return Array.isArray(list) ? list : [];
}

/** 布局里写的是实例名，真正的类型和参数从 spec.cards 里查。 */
export function resolveCard(spec, instanceId) {
  const card = spec.cards ? spec.cards[instanceId] : null;
  if (!card) return null;
  return { instance: instanceId, type: card.type, props: card.props || {} };
}
