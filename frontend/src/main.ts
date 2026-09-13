import { createApp } from 'vue'
import { createPinia } from 'pinia'

import AppShell from './app/AppShell.vue'
import router from './router'
import './styles/base.css'

createApp(AppShell).use(createPinia()).use(router).mount('#app')
