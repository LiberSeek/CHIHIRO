import { createRouter, createWebHistory } from 'vue-router'

import AgentModule from '@/modules/agent/AgentModule.vue'
import AssistantModule from '@/modules/assistant/AssistantModule.vue'
import ImModule from '@/modules/im/ImModule.vue'

const router = createRouter({
  history: createWebHistory('/next/'),
  routes: [
    { path: '/', redirect: '/im' },
    { path: '/im', name: 'im', component: ImModule, meta: { title: '消息' } },
    { path: '/agent', name: 'agent', component: AgentModule, meta: { title: '工作台' } },
    {
      path: '/assistant',
      name: 'assistant',
      component: AssistantModule,
      meta: { title: '会话助手' },
    },
  ],
})

export default router
