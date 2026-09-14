/**
 * IocSpec 和 URL 文本之间的转换。
 *
 * 用 base64url（把 +/ 换成 -_ 并去掉 =），这样可以直接放进 ?spec= 里，
 * 不会被 URL 编码规则弄坏。中文要按 UTF-8 转字节再编码，不能直接 btoa。
 */
function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const fill = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + '='.repeat(fill));
  const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeSpec(spec) {
  return toBase64Url(JSON.stringify(spec));
}

/** 解不出来就返回 null，调用方回退到默认配置，不要抛。 */
export function decodeSpec(text) {
  if (!text || typeof text !== 'string') return null;
  try {
    const value = JSON.parse(fromBase64Url(text));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch (error) {
    return null;
  }
}

/**
 * 只留下和园区默认值不一样的部分。
 *
 * 一份完整配置编码出来有 5KB 出头，链接长得没法看（聊天软件还会截断）。
 * 大屏启动时本来就是「园区默认值 + 覆盖项」，所以这里只挑出真正改过的键，
 * site 永远带上，这样换台机器打开也能落到同一个园区。
 */
export function compactSpec(spec, base) {
  const out = { site: spec.site };
  for (const key of Object.keys(spec)) {
    if (key === 'site') continue;
    if (key === 'views') {
      // views 在载入时按 id 合并，所以这里只带改过的几个就够
      const changed = (spec.views || []).filter(view => {
        const before = (base.views || []).find(item => item.id === view.id);
        return !before || JSON.stringify(view) !== JSON.stringify(before);
      });
      if (changed.length) out.views = changed;
      continue;
    }
    if (JSON.stringify(spec[key]) !== JSON.stringify(base[key])) out[key] = spec[key];
  }
  return out;
}

/** 生成可以直接分享的大屏地址。 */
export function shareUrl(spec, base) {
  const url = new URL(base || location.href);
  url.search = '';
  url.searchParams.set('spec', encodeSpec(spec));
  return url.toString();
}
