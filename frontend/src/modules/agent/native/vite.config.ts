import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../../../', import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL('../../../../../.cache/agent-native-build', import.meta.url)),
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL('./index.ts', import.meta.url)),
      formats: ['es'],
      fileName: 'agent-native',
    },
    rollupOptions: {
      external: ['vue', 'vue-router', 'pinia'],
    },
  },
})
