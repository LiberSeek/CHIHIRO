import { createRouter, createWebHistory } from 'vue-router'

import WorkspaceEntry from '@/modules/workspace/WorkspaceEntry.vue'
import AssistantModule from '@/modules/assistant/AssistantModule.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/im' },
    { path: '/im', name: 'im', component: WorkspaceEntry, meta: { title: '消息' } },
    { path: '/agent/:conversationId?', name: 'agent', component: WorkspaceEntry, meta: { title: '工作台' } },
    { path: '/customers', name: 'customers', component: () => import('@/modules/customers/CustomerModule.vue'), meta: { title: '客户资料' } },
    {
      path: '/assistant',
      name: 'assistant',
      component: AssistantModule,
      meta: { title: '会话助手' },
    },
  ],
})

export default router
