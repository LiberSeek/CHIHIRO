import { createApp } from 'vue'
import { createPinia } from 'pinia'

import AppShell from './app/AppShell.vue'
import router from './router'
import './styles/base.css'
import { agentLoaderKey, createAgentLoader } from './modules/agent/loader'
import { accountSessionManagerKey, createAccountSessionManager } from './services/account-session-host'
import { createImLoader, imLoaderKey } from './modules/im/loader'
import { useImWorkspace } from './modules/im/workspace'

const accountSessions = createAccountSessionManager()
const app = createApp(AppShell).use(createPinia()).use(router)
app.provide(agentLoaderKey, createAgentLoader(app))
app.provide(accountSessionManagerKey, accountSessions)
app.provide(imLoaderKey, createImLoader(app, view => {
  useImWorkspace().selectList(view)
}))
app.mount('#app')
