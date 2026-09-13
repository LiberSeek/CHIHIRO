import { computed, reactive, ref, shallowRef } from 'vue'
import type { AccountId } from '../../contracts'
import type { ImClient, ImConversation, ImMessage } from './im-client'

interface ConversationState {
  messages: ImMessage[]
  draft: string
  sending: boolean
  loading: boolean
  error: string
  historyVersion: number
}

/** Every asynchronous operation captures its account and conversation before awaiting. */
export function createImWorkspace(client: ImClient) {
  const account = ref<AccountId | null>(null)
  const conversations = ref<ImConversation[]>([])
  const active = ref<ImConversation | null>(null)
  const listError = ref('')
  const listLoading = ref(false)
  const current = shallowRef<ConversationState | null>(null)
  const states = new Map<string, ConversationState>()
  let listVersion = 0
  let disposed = false

  function stateFor(accountId: AccountId, conversation: ImConversation) {
    const key = JSON.stringify([accountId, conversation.id])
    let state = states.get(key)
    if (!state) {
      state = reactive({ messages: [], draft: '', sending: false, loading: false, error: '', historyVersion: 0 })
      states.set(key, state)
    }
    return state
  }

  async function setAccount(id: AccountId | null) {
    const version = ++listVersion
    account.value = id
    active.value = null
    current.value = null
    conversations.value = []
    listError.value = ''
    listLoading.value = Boolean(id)
    if (!id || disposed) return
    try {
      const result = await client.conversations(id)
      if (!disposed && version === listVersion) conversations.value = result
    } catch (error) {
      if (!disposed && version === listVersion) listError.value = messageOf(error, '无法加载会话')
    } finally {
      if (!disposed && version === listVersion) listLoading.value = false
    }
  }

  async function select(conversation: ImConversation) {
    const id = account.value
    if (!id || disposed || !conversations.value.some(item => item.id === conversation.id)) return
    active.value = conversation
    const state = stateFor(id, conversation)
    current.value = state
    // A pending send will refresh this state when the request finishes.
    if (!state.sending) await refresh(id, conversation, state)
  }

  async function refresh(id: AccountId, conversation: ImConversation, state: ConversationState) {
    const version = ++state.historyVersion
    state.loading = true
    state.error = ''
    try {
      const result = await client.messages(id, conversation.id)
      if (!disposed && version === state.historyVersion) state.messages = result
    } catch (error) {
      if (!disposed && version === state.historyVersion) state.error = messageOf(error, '无法加载消息')
    } finally {
      if (!disposed && version === state.historyVersion) state.loading = false
    }
  }

  async function send() {
    const id = account.value
    const conversation = active.value
    const state = current.value
    if (disposed || !id || !conversation || !state || state.sending || !state.draft.trim()) return
    const text = state.draft.trim()
    state.sending = true
    state.error = ''
    state.draft = ''
    ++state.historyVersion
    state.loading = false
    try {
      await client.send(id, conversation.id, text)
      // Read the actual history rather than inventing a successful local message.
      if (!disposed) await refresh(id, conversation, state)
    } catch (error) {
      if (!disposed) {
        state.error = messageOf(error, '发送未确认，请核对会话后再重试')
        if (!state.draft) state.draft = text
      }
    } finally {
      state.sending = false
    }
  }

  const draft = computed({
    get: () => current.value?.draft ?? '',
    set: (value: string) => { if (current.value) current.value.draft = value },
  })

  return {
    conversations, active, draft, listError, listLoading,
    messages: computed(() => current.value?.messages ?? []),
    sending: computed(() => current.value?.sending ?? false),
    loading: computed(() => current.value?.loading ?? false),
    error: computed(() => current.value?.error ?? ''),
    setAccount, select, send,
    dispose() { disposed = true; ++listVersion; states.clear(); current.value = null },
  }
}

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
