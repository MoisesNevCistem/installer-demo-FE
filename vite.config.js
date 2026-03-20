import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import os from 'os'
import path from 'path'
// import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      vue(),
      // vueDevTools(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    cacheDir: path.join(os.tmpdir(), 'vite-cache-monitfe'),
    server: {
      port: Number(process.env.VITE_APP_PORT) || Number(env.VITE_APP_PORT) || 5000,
      host: process.env.VITE_HOST || env.VITE_HOST || '0.0.0.0'
    }
  }
});