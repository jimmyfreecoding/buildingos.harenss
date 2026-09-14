import { sites } from './catalogues.js';
import { readRaw, migrateKey, LAST_SITE_KEY, LEGACY_SITE_KEY } from '../core/storage.js';
import jixing from '../sites/jixing/site.js';
import smart from '../sites/smart/site.js';
import houston from '../sites/houston/site.js';

export const siteDefinitions = [jixing, smart, houston];

/**
 * 首次打开用哪个园区。优先级：
 * 路径里的园区 > URL ?model= > 入口配置里的园区 > 浏览器保存 > VITE_CAMPUS_MODEL > jixing
 *
 * preferred 是 ioc.config.js 里那个项目指定的园区。它排在「明确的地址」后面、
 * 「浏览器记忆」前面 —— 配置文件管默认值，地址栏里的具体指定仍然说了算。
 */
export function initialSiteId(preferred) {
  // 路径里的园区（/jixing/ioc）最具体，优先
  const fromPath = location.pathname.match(/\/([^/]+)\/ioc\/?$/);
  const query = new URLSearchParams(location.search).get('model');
  // 旧 key 搬一次，老用户上次选的园区不会丢
  migrateKey(LEGACY_SITE_KEY, LAST_SITE_KEY);
  const saved = readRaw(LAST_SITE_KEY);
  const candidates = [fromPath ? decodeURIComponent(fromPath[1]) : null, query, preferred, saved, import.meta.env.VITE_CAMPUS_MODEL, 'jixing'];
  return candidates.find(id => sites.has(id)) || 'jixing';
}
