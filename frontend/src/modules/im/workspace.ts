import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ListTab = 'messages' | 'friends' | 'workbench'

/** List navigation and the open conversation have independent lifetimes. */
export const useImWorkspace = defineStore('im-workspace', () => {
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
    selectList('workbench')
    activePane.value = 'empty'
  }
  return { listTab, activePane, agentOpened, agentSessionId, mobilePane, drafts,
    selectList, selectAgent, selectIm, closeAgent }
})
