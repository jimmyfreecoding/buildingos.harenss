import config from '../../ioc.config.js';
import { registries } from '../registries/index.js';

/**
 * 入口解析：读 ioc.config.js，找出要用的项目和模式。
 *
 * 认不出来就回退到第一个项目 + 它的默认模式，并且把原因写进 notes，
 * 免得配置写错了整个页面打不开还看不出为什么。
 */
export function resolveBoot(registriesRef) {
  const registry = registriesRef || registries;
  const notes = [];
  // 地址栏可以临时盖掉配置文件，方便演示时切项目、切模式，不用改代码
  const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  const wantedProject = params.get('project') || config.project;
  const wantedMode = params.get('mode') || config.mode;

  let project = registry.projects.get(wantedProject);
  if (!project) {
    project = registry.projects.list()[0] || null;
    notes.push('入口配置里的项目「' + wantedProject + '」不存在，已回退到「' + (project ? project.id : '无') + '」');
  }

  const declared = project ? project.mode : 'dashboard';
  const mode = wantedMode || declared;
  if (wantedMode && project && wantedMode !== declared) {
    notes.push('入口配置把模式从「' + declared + '」改成了「' + wantedMode + '」');
  }

  return {
    project,
    mode,
    notes,
    // 项目的默认配置：园区、主题、布局
    baseOverrides: project ? {
      site: project.site,
      theme: project.theme,
      layout: project.layout,
    } : {},
    slides: (project && project.slides) || [],
    availableProjects: registry.projects.list().map(item => ({
      id: item.id, name: item.name, mode: item.mode, slides: (item.slides || []).length,
    })),
  };
}
