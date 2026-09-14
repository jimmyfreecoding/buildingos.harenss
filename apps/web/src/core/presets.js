import { decodeSpec } from './spec/serialize.js';
import { readJson, writeJson, removeKey } from './storage.js';

/**
 * 预设和草稿都存在浏览器里，没有后端。
 *
 * - ioc:presets：具名预设，搭建页可以保存、载入、删除
 * - ioc:spec-draft：搭建页正在编辑的那份；大屏在没有 ?spec= / ?preset= 时会用它
 */
const PRESETS_KEY = 'ioc:presets';
const DRAFT_KEY = 'ioc:spec-draft';

export function listPresets() {
  const value = readJson(PRESETS_KEY, []);
  return Array.isArray(value) ? value : [];
}

export function savePreset(name, spec) {
  const presets = listPresets().filter(item => item.name !== name);
  presets.push({ name, spec, savedAt: new Date().toISOString() });
  writeJson(PRESETS_KEY, presets);
  return presets;
}

export function removePreset(name) {
  const presets = listPresets().filter(item => item.name !== name);
  writeJson(PRESETS_KEY, presets);
  return presets;
}

export function findPreset(name) {
  return listPresets().find(item => item.name === name) || null;
}

export function readDraft() {
  return readJson(DRAFT_KEY, null);
}

export function saveDraft(spec) {
  writeJson(DRAFT_KEY, spec);
}

export function clearDraft() {
  removeKey(DRAFT_KEY);
}

/**
 * 大屏启动时读覆盖项，优先级：URL ?spec= > URL ?preset= > 空（纯园区默认值）。
 *
 * 刻意不读本地草稿：草稿是搭建页的工作副本，大屏只认地址栏里的配置，
 * 否则「打开某个地址」看到的东西会取决于浏览器里存了什么，很难解释。
 */
export function readSpecOverrides(search) {
  const params = new URLSearchParams(search === undefined ? location.search : search);
  const fromUrl = decodeSpec(params.get('spec'));
  if (fromUrl) return fromUrl;
  const presetName = params.get('preset');
  if (presetName) {
    const preset = findPreset(presetName);
    if (preset) return preset.spec || {};
  }
  return {};
}
