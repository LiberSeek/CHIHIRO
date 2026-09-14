import { createRouter, createWebHistory } from 'vue-router'

import AssistantModule from '@/modules/assistant/AssistantModule.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/im' },
    { path: '/im', name: 'im', component: () => import('@/modules/im/ImEntry.vue'), meta: { title: '消息' } },
    { path: '/agent/:conversationId?', name: 'agent', component: () => import('@/modules/agent/AgentEntry.vue'), meta: { title: '工作台' } },
    {
      path: '/assistant',
      name: 'assistant',
      component: AssistantModule,
      meta: { title: '会话助手' },
    },
  ],
})

export default router
