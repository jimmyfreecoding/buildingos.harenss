import { createRegistry } from '../core/registry.js';

/**
 * 六个清单本身。
 *
 * 条目在 sites.js / scenes.js 等处定义，统一由 index.js 注册进来，
 * 这样这里不需要知道任何具体园区，也不会出现互相 import 成环。
 */
export const sites = createRegistry('园区');
export const scenes = createRegistry('场景模型');
export const cards = createRegistry('卡片', { idField: 'type' });
export const layouts = createRegistry('布局');
export const themes = createRegistry('主题');
export const dataSources = createRegistry('数据源');
export const projects = createRegistry('项目');
