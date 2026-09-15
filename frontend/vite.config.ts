import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import yaml from '@modyfi/vite-plugin-yaml'
import { defineConfig } from 'vite'
import prefixSelector from 'postcss-prefix-selector'

export default defineConfig({
  base: '/',
  define: { 'import.meta.env.VITE_CHIHIRO': true },
  plugins: [vue(), yaml()],
  css: {
    postcss: { plugins: [prefixSelector({
      prefix: ':where(.chihiro-native-im, #chihiro-im-overlays)',
      includeFiles: ['/modules/im/native/'],
      transform(prefix, selector, prefixedSelector) {
        // Theme classes belong to the document, while their tokens stay inside IM.
        if (selector === ':root' || selector === 'html' || selector === 'body') return prefix
        if (/^(html|:root)(\.bp-(dark|light)|\[data-theme=(["'])?(dark|light)\4\])$/.test(selector)) {
          return `${selector} ${prefix}`
        }
        return prefixedSelector
      },
    })] },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@renderer': fileURLToPath(new URL('./src/modules/im/native/src', import.meta.url)),
      '@chihiro/im-native': fileURLToPath(new URL('./src/modules/im/native', import.meta.url)),
    },
  },
  build: {
    // Gateway serves dist while local rebuilds happen; keep previous hashed
    // files so an open workbench tab can still fetch lazy chunks.
    emptyOutDir: false,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3100',
      '/astrbot': 'http://127.0.0.1:3100',
      '/webui': 'http://127.0.0.1:3100',
      '/i': { target: 'http://127.0.0.1:3100', ws: true },
    },
  },
})
