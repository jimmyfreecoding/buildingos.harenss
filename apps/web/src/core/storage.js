/**
 * 浏览器存储的小封装。
 *
 * 约定：所有 key 都带 ioc: 前缀；和园区有关的状态再加园区 id，
 * 否则两个园区的状态会互相覆盖（告警处理状态就踩过这个坑）。
 * 旧 key 会在第一次读取时搬过来，不让已经用过的浏览器丢设置。
 */
export function readRaw(key) {
  try { return localStorage.getItem(key); } catch (error) { return null; }
}

export function writeRaw(key, value) {
  try { localStorage.setItem(key, value); } catch (error) { /* 浏览器可能禁用了 Storage */ }
}

export function readJson(key, fallback) {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  try { return JSON.parse(raw); } catch (error) { return fallback; }
}

export function writeJson(key, value) {
  writeRaw(key, JSON.stringify(value));
}

export function removeKey(key) {
  try { localStorage.removeItem(key); } catch (error) { /* 忽略 */ }
}

/** 把旧 key 的值搬到新 key，只搬一次；搬完把旧的删掉。 */
export function migrateKey(oldKey, newKey) {
  const legacy = readRaw(oldKey);
  if (legacy === null) return;
  if (readRaw(newKey) === null) writeRaw(newKey, legacy);
  removeKey(oldKey);
}

/** 园区相关的 key：ioc:<园区>:<名字> */
export function siteKey(siteId, name) {
  return 'ioc:' + siteId + ':' + name;
}

export const LAST_SITE_KEY = 'ioc:last-site';
export const LEGACY_SITE_KEY = 'ioc-campus-model';
export const LEGACY_ALARM_KEY = 'ioc-resolved-alarms';
