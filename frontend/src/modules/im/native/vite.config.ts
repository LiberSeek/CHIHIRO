import { fileURLToPath, URL } from 'node:url'

import yaml from '@modyfi/vite-plugin-yaml'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue(), yaml()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../../../', import.meta.url)),
      '@renderer': fileURLToPath(new URL('./src', import.meta.url)),
      '@chihiro/im-native': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL('../../../../../.cache/im-native-build', import.meta.url)),
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL('./index.ts', import.meta.url)),
      formats: ['es'],
      fileName: 'im-native',
    },
    rollupOptions: {
      external: ['vue', 'pinia'],
    },
  },
})
