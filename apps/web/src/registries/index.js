import { IOC_CONTEXT } from '../core/context.js';
import { sites, scenes, cards, layouts, themes, dataSources, projects } from './catalogues.js';
import { siteDefinitions, initialSiteId } from './sites.js';
import { sceneDefinitions } from './scenes.js';
import { dataSourceDefinitions } from './datasources.js';
import { cardDefinitions } from './cards.js';
import { layoutDefinitions } from './layouts.js';
import { projectDefinitions } from './projects.js';
import { themeDefinitions } from './themes.js';

// 这里是唯一把条目填进清单的地方。
sites.registerAll(siteDefinitions);
scenes.registerAll(sceneDefinitions);
dataSources.registerAll(dataSourceDefinitions);
cards.registerAll(cardDefinitions);
layouts.registerAll(layoutDefinitions);
projects.registerAll(projectDefinitions);
themes.registerAll(themeDefinitions);

export const registries = { sites, scenes, cards, layouts, themes, dataSources, projects };
export { sites, scenes, cards, layouts, themes, dataSources, initialSiteId };

/** Vue 插件：把清单挂到 app 上。 */
export function install(app) {
  app.provide(IOC_CONTEXT, { registries });
  return registries;
}

export default { install };
