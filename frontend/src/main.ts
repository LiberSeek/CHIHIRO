import { createApp } from 'vue'
import { createPinia } from 'pinia'

import AppShell from './app/AppShell.vue'
import router from './router'
import './styles/base.css'
import { agentLoaderKey, createAgentLoader } from './modules/agent/loader'
import { accountSessionManagerKey, createAccountSessionManager } from './services/account-session-host'
import { createWorkspaceLoader, workspaceLoaderKey } from './modules/workspace/loader'
import { useWorkspace } from './modules/workspace/workspace'

const accountSessions = createAccountSessionManager()
const app = createApp(AppShell).use(createPinia()).use(router)
app.provide(agentLoaderKey, createAgentLoader(app))
app.provide(accountSessionManagerKey, accountSessions)
app.provide(workspaceLoaderKey, createWorkspaceLoader(app, view => {
  useWorkspace().selectList(view)
}))
app.mount('#app')

if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      if (registration.scope === `${location.origin}/`) void registration.unregister()
    }
  })
}
