import { createApp } from 'vue'
import { createPinia } from 'pinia'

import AppShell from './app/AppShell.vue'
import router from './router'
import './styles/base.css'
import { installAgentNative } from './modules/agent/native/runtime'

const app = createApp(AppShell).use(createPinia()).use(router)
void installAgentNative(app, { hosted: true }).then(() => app.mount('#app'))
