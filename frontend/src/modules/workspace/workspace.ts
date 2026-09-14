import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { BaseChatInfoElem } from '../im/native/src/function/elements/information'

export type ListTab = 'messages' | 'friends' | 'workbench'

export type WorkspaceRoute = { path: '/im'; query?: { tab?: 'friends' | 'workbench'; chat?: string } }

export function routeForWorkspaceList(tab: ListTab): WorkspaceRoute {
  if (tab === 'friends') return { path: '/im', query: { tab: 'friends' } }
  if (tab === 'workbench') return { path: '/im', query: { tab: 'workbench' } }
  return { path: '/im' }
}

export function imConversationRouteKey(info: Pick<BaseChatInfoElem, 'type' | 'id'>): string {
  if (!info.id) return ''
  const type = info.type === 'group' ? 'group' : 'user'
  return `${type}:${info.id}`
}

export function routeForImConversation(info: Pick<BaseChatInfoElem, 'type' | 'id'>): WorkspaceRoute {
  const chat = imConversationRouteKey(info)
  return chat ? { path: '/im', query: { chat } } : { path: '/im' }
}

export function parseImConversationRouteKey(value: unknown): { type: 'user' | 'group'; id: number } | null {
  if (Array.isArray(value)) value = value[0]
  if (typeof value !== 'string') return null
  const match = /^(user|group):(-?\d+)$/.exec(value)
  if (!match) return null
  return { type: match[1] as 'user' | 'group', id: Number(match[2]) }
}

/** List navigation and the open conversation have independent lifetimes. */
export const useWorkspace = defineStore('workspace', () => {
  const listTab = ref<ListTab>('messages')
  const activePane = ref<'im' | 'agent' | 'empty'>('im')
  const agentOpened = ref(false)
  const agentSessionId = ref<string | null>(null)
  const mobilePane = ref<'list' | 'chat'>('list')
  const drafts = ref<Record<string, string>>({})

  function selectList(tab: ListTab) {
    listTab.value = tab
    mobilePane.value = 'list'
    if (tab === 'workbench') agentOpened.value = true
  }
  function selectAgent(sessionId: string) {
    agentOpened.value = true
    agentSessionId.value = sessionId
    activePane.value = 'agent'
    mobilePane.value = 'chat'
  }
  function selectIm() {
    activePane.value = 'im'
    mobilePane.value = 'chat'
  }
  function closeAgent() {
    activePane.value = 'empty'
    mobilePane.value = 'list'
  }
  return { listTab, activePane, agentOpened, agentSessionId, mobilePane, drafts,
    selectList, selectAgent, selectIm, closeAgent }
})
