import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [vue()], test: { include: ['src/**/*.test.ts'] }, server: { port: 5173, strictPort: true, proxy: env.YC_API_PROXY ? { '/admin-api': { target: env.YC_API_PROXY, changeOrigin: true } } : undefined } }
})
