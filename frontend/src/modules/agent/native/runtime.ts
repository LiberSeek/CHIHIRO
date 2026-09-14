import type { App } from 'vue'

import 'vuetify/styles'
import 'markstream-vue/index.css'
import '@mdi/font/css/materialdesignicons.css'

import { configureApiBase } from './src/api/v1'
import { setupHttpClient } from './src/api/http'
import { setupI18n } from './src/i18n/composables'
import { createAgentVuetify } from './vuetify'

export type AgentNativeOptions = {
  hosted?: boolean
  initializeLocale?: boolean
}

const installations = new WeakMap<App, Promise<void>>()

export function installAgentNative(app: App, options: AgentNativeOptions = {}) {
  const installed = installations.get(app)
  if (installed) return installed
  const pending = initializeAgentNative(app, options).catch(error => {
    installations.delete(app)
    throw error
  })
  installations.set(app, pending)
  return pending
}

async function initializeAgentNative(app: App, options: AgentNativeOptions) {
  configureApiBase(options.hosted ?? true)
  setupHttpClient()
  if (options.initializeLocale ?? true) await setupI18n()
  app.use(createAgentVuetify())
}
