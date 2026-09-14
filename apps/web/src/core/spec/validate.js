import { isPlainObject } from './iocSpec.js';

function idList(registry) {
  const ids = registry.ids();
  return ids.length ? ids.join(' / ') : '(清单为空)';
}

function checkOneProp(instanceId, key, value, rule) {
  const errors = [];
  const where = '卡片「' + instanceId + '」的字段「' + key + '」';
  if (rule.type === 'string') {
    if (typeof value !== 'string') errors.push(where + '应该是字符串');
    else if (rule.maxLength && value.length > rule.maxLength) errors.push(where + '超过 ' + rule.maxLength + ' 个字');
  } else if (rule.type === 'number') {
    if (typeof value !== 'number' || Number.isNaN(value)) errors.push(where + '应该是数字');
    else {
      if (rule.min !== undefined && value < rule.min) errors.push(where + '不能小于 ' + rule.min);
      if (rule.max !== undefined && value > rule.max) errors.push(where + '不能大于 ' + rule.max);
    }
  } else if (rule.type === 'boolean') {
    if (typeof value !== 'boolean') errors.push(where + '应该是 true / false');
  } else if (rule.type === 'array') {
    if (!Array.isArray(value)) errors.push(where + '应该是数组');
    else if (Array.isArray(rule.items)) {
      for (const item of value) {
        if (!rule.items.includes(item)) errors.push(where + '里有不允许的值「' + item + '」');
      }
    }
  }
  return errors;
}

function checkCardProps(instanceId, props, schema) {
  const errors = [];
  if (!schema) return errors;
  for (const [key, value] of Object.entries(props)) {
    const rule = schema[key];
    if (!rule) { errors.push('卡片「' + instanceId + '」的字段「' + key + '」不允许修改'); continue; }
    errors.push(...checkOneProp(instanceId, key, value, rule));
  }
  return errors;
}

/**
 * 检查一份配置能不能用。
 *
 * 只做「名字在不在清单里」「字段类型对不对」这类硬检查，不改内容。
 * 返回 { ok, errors }，errors 是可以直接给人看的中文说明。
 */
export function validateSpec(spec, registries) {
  const errors = [];

  if (!isPlainObject(spec)) return { ok: false, errors: ['配置不是一个对象'] };

  if (!registries.sites.has(spec.site)) {
    errors.push('园区「' + (spec.site || '(空)') + '」不存在，可用：' + idList(registries.sites));
  }
  if (!registries.themes.has(spec.theme)) {
    errors.push('主题「' + (spec.theme || '(空)') + '」不存在，可用：' + idList(registries.themes));
  }
  if (!registries.layouts.has(spec.layout)) {
    errors.push('布局「' + (spec.layout || '(空)') + '」不存在，可用：' + idList(registries.layouts));
  }

  const main = spec.scene && spec.scene.main ? spec.scene.main.provider : '';
  if (!registries.scenes.has(main)) {
    errors.push('场景模型「' + (main || '(空)') + '」不存在，可用：' + idList(registries.scenes));
  }
  for (const overlay of (spec.scene && spec.scene.overlays) || []) {
    if (!registries.scenes.has(overlay.provider)) {
      errors.push('覆盖层模型「' + (overlay.provider || '(空)') + '」不存在');
    }
  }

  for (const id of spec.dataSources || []) {
    if (!registries.dataSources.has(id)) {
      errors.push('数据源「' + id + '」不存在，可用：' + idList(registries.dataSources));
    }
  }

  const views = Array.isArray(spec.views) ? spec.views : [];
  if (!views.length) errors.push('配置里没有任何态势（views）');

  const layout = registries.layouts.get(spec.layout);
  const regionIds = layout ? layout.regions.map(region => region.id) : [];

  for (const view of views) {
    const regions = isPlainObject(view.regions) ? view.regions : {};
    for (const [regionId, list] of Object.entries(regions)) {
      if (layout && !regionIds.includes(regionId)) {
        errors.push('态势「' + view.id + '」用了布局里不存在的区域「' + regionId + '」');
      }
      for (const instanceId of list || []) {
        const instance = spec.cards ? spec.cards[instanceId] : null;
        if (!instance) {
          errors.push('态势「' + view.id + '」的区域「' + regionId + '」引用了没定义的卡片「' + instanceId + '」');
          continue;
        }
        const definition = registries.cards.get(instance.type);
        if (!definition) {
          errors.push('卡片「' + instanceId + '」的类型「' + instance.type + '」不存在，可用：' + idList(registries.cards));
          continue;
        }
        errors.push(...checkCardProps(instanceId, instance.props || {}, definition.propsSchema));
      }
    }
  }

  const active = spec.navigation ? spec.navigation.active : '';
  if (!views.some(view => view.id === active)) {
    errors.push('当前态势「' + (active || '(空)') + '」不在 views 里');
  }

  return { ok: errors.length === 0, errors };
}
