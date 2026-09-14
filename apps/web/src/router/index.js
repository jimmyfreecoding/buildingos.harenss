import { createRouter, createWebHistory } from 'vue-router'

// 入口按 ioc.config.js 分派；下面两个带后缀的地址可以强制进某一种模式
const IocEntry = () => import('../views/IocEntry.vue')
const IocDashboard = () => import('../views/IocDashboard.vue')
const IocStudio = () => import('../views/IocStudio.vue')

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'IOC', component: IocEntry },
    { path: '/ioc', name: 'IocHome', component: IocEntry },
    // 强制大屏 / 强制演示，调试和演示时直接用
    { path: '/ioc/dashboard', name: 'IocDashboard', component: IocEntry, props: { forceMode: 'dashboard' } },
    { path: '/ioc/deck', name: 'IocDeck', component: IocEntry, props: { forceMode: 'deck' } },
    { path: '/ioc/studio', name: 'IocStudio', component: IocStudio },
    // 把园区放进路径：/jixing/ioc、/smart/ioc。
    // 这条路径已经明确指定了园区，所以不套入口配置里的园区和主题
    { path: '/:site/ioc', name: 'SiteIoc', component: IocDashboard },
    { path: '/:pathMatch(.*)*', redirect: '/ioc' },
  ],
})
