import { describe, expect, it, vi } from 'vitest'
import { accountId, conversationId } from '../../contracts'
import { createImClient } from './im-client'

describe('IM client account scoping', () => {
  it('sends the selected account on every request', async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => ({ ok: true, json: async () => [] , headers: init?.headers }))
    vi.stubGlobal('fetch', fetcher)
    const client = createImClient()
    await client.messages(accountId('qq:a'), conversationId('peer:1'))
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('peer%3A1'), expect.objectContaining({ headers: { 'X-Chihiro-Account': 'qq:a' } }))
    vi.unstubAllGlobals()
  })
  it('sends text with account and conversation identity', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({}) }))
    vi.stubGlobal('fetch', fetcher)
    await createImClient().send(accountId('qq:b'), conversationId('group:2'), 'hello')
    expect(fetcher).toHaveBeenCalledWith('/api/runtime/im/send', expect.objectContaining({ method: 'POST', body: JSON.stringify({ conversationId: 'group:2', text: 'hello' }) }))
    vi.unstubAllGlobals()
  })
})
