import type { App } from 'vue'

import 'vuetify/styles'
import 'markstream-vue/index.css'
import '@mdi/font/css/materialdesignicons.css'

import { configureApiBase } from './source/api/v1'
import { setupHttpClient } from './source/api/http'
import { setupI18n } from './source/i18n/composables'
import { createAgentVuetify } from './vuetify'

export type AgentNativeOptions = {
  hosted?: boolean
  initializeLocale?: boolean
}

export async function installAgentNative(app: App, options: AgentNativeOptions = {}) {
  configureApiBase(options.hosted ?? true)
  setupHttpClient()
  if (options.initializeLocale ?? true) await setupI18n()
  app.use(createAgentVuetify())
}
