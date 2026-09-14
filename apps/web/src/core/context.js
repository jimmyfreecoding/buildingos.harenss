import { inject, provide } from 'vue';

/** 运行环境的注入键。下层组件靠它拿到园区、清单、场景和数据。 */
export const IOC_CONTEXT = Symbol('ioc-context');

export function createIocContext(parts = {}) {
  return {
    spec: null,        // 当前这份完整配置
    site: null,        // 当前园区定义
    registries: null,  // 各清单
    scene: null,       // 场景句柄
    data: null,        // 数据容器
    theme: null,       // 当前主题
    edit: null,        // 演示模式的自由布局编辑状态（大屏是 null）
    ...parts,
  };
}

/** 在组件里往下传 */
export function provideIocContext(context) {
  provide(IOC_CONTEXT, context);
  return context;
}

/** 挂到 app 级别（给不是组件的地方用） */
export function installIocContext(app, context) {
  app.provide(IOC_CONTEXT, context);
  return context;
}

export function useIocContext(options = {}) {
  const context = inject(IOC_CONTEXT, null);
  if (!context) {
    if (options.optional) return null;
    throw new Error('这里拿不到 IOC 运行环境：外层缺少 provideIocContext');
  }
  return context;
}
