import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import yaml from '@modyfi/vite-plugin-yaml'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/next/',
  plugins: [vue(), yaml()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@renderer': fileURLToPath(new URL('./src/modules/im/native/src', import.meta.url)),
      '@chihiro/im-native': fileURLToPath(new URL('./src/modules/im/native', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3100',
      '/astrbot': 'http://127.0.0.1:3100',
      '/webui': 'http://127.0.0.1:3100',
    },
  },
})
