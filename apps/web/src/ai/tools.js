import { DATA_SLOTS } from '../datasources/slots.js';

/**
 * 给 AI 的工具。
 *
 * 只读工具随便调；能改东西的只有 apply_spec_patch 一个。
 * 只留一个写入口是有意的：
 * - 出错时最多是排得不好看，不会把页面弄坏；
 * - 每次改动就是一段 JSON，撤销 = 把上一份配置存回去；
 * - 需要检查的地方只有一处。
 */
export const READ_TOOLS = [
  { name: 'list_sites', description: '列出可用园区，以及各自默认的模型、主题、布局' },
  { name: 'list_cards', description: '列出卡片类型、名称、分组和它读取的数据槽' },
  { name: 'list_layouts', description: '列出布局，以及每个布局有哪些区域 id' },
  { name: 'list_themes', description: '列出可用主题' },
  { name: 'list_data_sources', description: '列出数据源，以及各自支持哪些数据槽' },
  { name: 'get_spec', description: '读取当前完整配置' },
];

export const WRITE_TOOLS = [
  {
    name: 'apply_spec_patch',
    description: '对配置应用一次改动。这是唯一能改东西的工具，改动会先给用户确认。',
    parameters: {
      type: 'object',
      properties: {
        ops: {
          type: 'array',
          description: '按顺序执行的改动，支持 add / remove / replace / move',
          items: {
            type: 'object',
            properties: {
              op: { enum: ['add', 'remove', 'replace', 'move'] },
              path: { type: 'string', description: '只允许 /cards/*、/views/*/regions/*、/theme、/layout、/site、/navigation' },
              from: { type: 'string' },
              value: {},
            },
            required: ['op', 'path'],
          },
        },
      },
      required: ['ops'],
    },
  },
];

export const ALL_TOOLS = [...READ_TOOLS, ...WRITE_TOOLS];

/** 只读工具的执行。写工具不在这里跑 —— 它要先去 sanitize 和用户确认。 */
export function runReadTool(name, args, { registries, spec }) {
  switch (name) {
    case 'list_sites':
      return registries.sites.list().map(site => ({
        id: site.id,
        name: site.name,
        defaultScene: site.defaultScene,
        defaultTheme: site.defaultTheme,
        defaultLayout: site.defaultLayout,
        views: (site.views || []).map(view => view.id),
      }));
    case 'list_cards':
      return registries.cards.list().map(card => ({
        type: card.type,
        name: card.name,
        group: card.group,
        slots: Object.values(card.data || {}).map(entry => entry.slot),
        props: Object.keys(card.propsSchema || {}),
      }));
    case 'list_layouts':
      return registries.layouts.list().map(layout => ({
        id: layout.id,
        name: layout.name,
        regions: layout.regions.map(region => ({ id: region.id, role: region.role, label: region.label })),
      }));
    case 'list_themes':
      return registries.themes.list().map(theme => ({ id: theme.id, name: theme.name }));
    case 'list_data_sources':
      return registries.dataSources.list().map(source => ({ id: source.id, label: source.label, slots: source.slots }));
    case 'list_slots':
      return Object.keys(DATA_SLOTS);
    case 'get_spec':
      return spec;
    default:
      throw new Error('没有这个工具：' + name);
  }
}
