import type { AccountId, ConversationId } from '../../contracts'

export interface ImConversation { id: ConversationId; title: string; kind: 'direct' | 'group'; unread?: number }
export interface ImMessage { id: string; text: string; sender: string; at?: string; outgoing?: boolean }

export interface ImClient {
  conversations(accountId: AccountId): Promise<ImConversation[]>
  messages(accountId: AccountId, conversationId: ConversationId): Promise<ImMessage[]>
  send(accountId: AccountId, conversationId: ConversationId, text: string): Promise<void>
}

export function createImClient(base = '/api'): ImClient {
  const get = async <T>(path: string, accountId: AccountId): Promise<T> => {
    const response = await fetch(`${base}${path}`, { headers: { 'X-Chihiro-Account': accountId } })
    if (!response.ok) throw new Error(`IM API ${response.status}`)
    return response.json() as Promise<T>
  }
  return {
    conversations: (accountId) => get<ImConversation[]>(`/runtime/im/conversations`, accountId),
    messages: (accountId, conversationId) => get<ImMessage[]>(`/runtime/im/conversations/${encodeURIComponent(conversationId)}/messages`, accountId),
    async send(accountId, conversationId, text) {
      const response = await fetch(`${base}/runtime/im/send`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Chihiro-Account': accountId }, body: JSON.stringify({ conversationId, text }) })
      if (!response.ok) throw new Error(`IM API ${response.status}`)
    },
  }
}
