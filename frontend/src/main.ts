import { createApp } from 'vue'
import { createPinia } from 'pinia'

import AppShell from './app/AppShell.vue'
import router from './router'
import './styles/base.css'
import { agentLoaderKey, createAgentLoader } from './modules/agent/loader'

const app = createApp(AppShell).use(createPinia()).use(router)
app.provide(agentLoaderKey, createAgentLoader(app))
app.mount('#app')
