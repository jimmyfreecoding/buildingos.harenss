import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 端口说明：3888 被 buildingos.ioc 的 dev server 占着，所以错开到 3890/4890。
// /api 代理到后端服务，开发时前端代码直接写 fetch('/api/...')，
// 生产环境由 nginx 做同样的反代，前端代码不用改。
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 3890,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4890,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
