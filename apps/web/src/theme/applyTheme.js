/**
 * 把主题的 tokens 变成一个 <style> 标签里的 CSS 变量，挂到 .ioc-shell 上。
 *
 * 为什么不直接写在 ioc.css 里：主题是可切换的，变量得在运行时换。
 * 同一个 id 重复应用会替换掉旧的标签，不会越挂越多。
 *
 * 主题还可以带一张 skin（CSS 文本）。tokens 只能换颜色，而深色那套面板是
 * 透明的、浅色那套要变成白色圆角卡片 —— 这种「形状」上的差别用皮肤来写，
 * 好处是没带皮肤的主题（比如默认那套）样式一个字节都不会变。
 */
const STYLE_ID = 'ioc-theme-tokens';

export function tokenBlock(theme) {
  const lines = Object.entries(theme.tokens || {}).map(([name, value]) => name + ':' + value + ';');
  return '.ioc-shell{' + lines.join('') + '}';
}

export function themeBlock(theme) {
  return tokenBlock(theme) + (theme && theme.skin ? '\n' + theme.skin : '');
}

export function applyTheme(theme, doc = document) {
  let el = doc.getElementById(STYLE_ID);
  if (!el) {
    el = doc.createElement('style');
    el.id = STYLE_ID;
    doc.head.appendChild(el);
  }
  el.textContent = themeBlock(theme);
  return theme;
}

export function clearTheme(doc = document) {
  const el = doc.getElementById(STYLE_ID);
  if (el) el.remove();
}
