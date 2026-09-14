/**
 * 系统入口配置。
 *
 * 改这个文件决定「进来看到什么」：
 * - project：用哪个项目（见 src/projects/<id>/project.js）
 * - mode：覆盖项目的默认模式。null 表示听项目的；也可以写 'dashboard' 或 'deck'
 *
 * 每个项目有自己完整的一套 IOC 配置：园区、主题、布局、态势，以及演示文稿的页。
 * 不想改文件也可以用地址栏临时覆盖：?project=jixing-deck&mode=deck
 *
 * 想进别的模式：
 *   /ioc/dashboard   运营大屏
 *   /ioc/deck        演示文稿（左右键翻页）
 */
export default {
  project: 'jili-smart-deck',
  mode: null,
};
