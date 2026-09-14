/**
 * 外部 Unreal Pixel Streaming 播放器。
 *
 * 和本地 WebGL 模型走同一套契约（同样是 create(container, context)），
 * 但它没有任何本地能力，所以 capabilities 是空的。
 *
 * P1 阶段只是把契约和登记补齐：真正切换串流时，页面仍然是销毁/保留本地
 * 场景由应用层控制。等运行时接管「场景槽」（P4 之后）再统一切换方式。
 */
export default {
  id: 'unreal-stream',
  label: '外部 Unreal Pixel Streaming',
  kind: 'stream',
  capabilities: [],
  create(container, context = {}) {
    const options = context.options || {};
    const iframe = document.createElement('iframe');
    iframe.src = options.url || '';
    iframe.className = 'unreal-player';
    iframe.title = 'Unreal Engine Pixel Streaming 园区';
    iframe.allow = 'autoplay; fullscreen; gamepad';
    iframe.setAttribute('allowfullscreen', '');
    iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0';
    container.appendChild(iframe);
    return {
      dispose() { iframe.remove(); },
    };
  },
};
