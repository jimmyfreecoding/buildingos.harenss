import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import LineChart from './widgets/LineChart.vue'

// 这里不 import 注册表：它会把 3D 建模代码一起拉进首屏包。
// 注册表由 IOC 页面自己按需加载（见 src/views/IocDashboard.vue）。
const app = createApp(App)
app.use(router)
// 曲线图被两张卡片（能耗、人流）共用。卡片是异步加载的，如果两张卡同时去取这个
// 共用组件，开发服务器偶尔会把这份请求掐断（浏览器报 ERR_ABORTED，卡片就挂不上）。
// 在外壳这里先注册成全局组件，异步卡片就不必再去取它了。
app.component('Chart', LineChart)
app.mount('#app')

