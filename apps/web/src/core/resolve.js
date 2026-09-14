import { normalizeSpec } from './spec/iocSpec.js';

/** 把卡片清单变成默认的卡片实例表：一个类型一个实例，用类型名当实例名。 */
function defaultCardInstances(cards) {
  const instances = {};
  for (const definition of cards.list()) {
    instances[definition.type] = { type: definition.type, props: { ...definition.props } };
  }
  return instances;
}

/**
 * 合成一份完整配置：园区默认值 + 传入的覆盖项。
 *
 * 覆盖项先合并，再交给 normalizeSpec 做「空白默认值 -> 园区默认值 -> 覆盖项」，
 * 所以调用方只需要写它想改的那几项。
 */
export function resolveSpec(site, registries, overrides) {
  const input = { ...(overrides || {}) };
  if (!input.cards) input.cards = { ...defaultCardInstances(registries.cards), ...site.cards };
  return normalizeSpec(input, site);
}
