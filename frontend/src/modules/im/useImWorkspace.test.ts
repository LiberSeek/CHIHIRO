import { describe, expect, it, vi } from 'vitest'
import { accountId, conversationId } from '../../contracts'
import type { ImClient, ImConversation, ImMessage } from './im-client'
import { createImWorkspace } from './useImWorkspace'

const a = accountId('qq:a'), b = accountId('qq:b')
const peer: ImConversation = { id: conversationId('private:123'), title: '相同联系人', kind: 'direct' }
const other: ImConversation = { id: conversationId('group:123'), title: '群', kind: 'group' }
const message = (text: string): ImMessage => ({ id: text, sender: '123', text })
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function client(overrides: Partial<ImClient> = {}): ImClient {
  return { conversations: async () => [peer, other], messages: async () => [], send: async () => {}, ...overrides }
}

describe('IM workspace asynchronous ownership', () => {
  it('ignores an old account list returning after the new account list', async () => {
    const old = deferred<ImConversation[]>()
    const ws = createImWorkspace(client({ conversations: id => id === a ? old.promise : Promise.resolve([other]) }))
    const request = ws.setAccount(a)
    await ws.setAccount(b)
    old.resolve([peer]); await request
    expect(ws.conversations.value).toEqual([other])
  })

  it('keeps identical peer history and drafts separate across accounts', async () => {
    const old = deferred<ImMessage[]>()
    const ws = createImWorkspace(client({ messages: id => id === a ? old.promise : Promise.resolve([message('B')]) }))
    await ws.setAccount(a)
    const request = ws.select(peer)
    ws.draft.value = 'A draft'
    await ws.setAccount(b); await ws.select(peer)
    ws.draft.value = 'B draft'
    old.resolve([message('A')]); await request
    expect(ws.messages.value).toEqual([message('B')])
    expect(ws.draft.value).toBe('B draft')
    await ws.setAccount(a); await ws.select(peer)
    expect(ws.draft.value).toBe('A draft')
  })

  it('keeps a pending send and failure attached to the original conversation', async () => {
    const pending = deferred<void>()
    const send = vi.fn(() => pending.promise)
    const ws = createImWorkspace(client({ send }))
    await ws.setAccount(a); await ws.select(peer)
    ws.draft.value = 'A outgoing'
    const request = ws.send()
    await ws.setAccount(b); await ws.select(peer)
    ws.draft.value = 'B unsent'
    pending.reject(new Error('network uncertain')); await request
    expect(send).toHaveBeenCalledExactlyOnceWith(a, peer.id, 'A outgoing')
    expect(ws.draft.value).toBe('B unsent')
    expect(ws.error.value).toBe('')
    await ws.setAccount(a); await ws.select(peer)
    expect(ws.draft.value).toBe('A outgoing')
  })

  it('reloads confirmed history after send without adding a made-up message', async () => {
    const pending = deferred<void>()
    const messages = vi.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('history unavailable'))
    const ws = createImWorkspace(client({ messages, send: () => pending.promise }))
    await ws.setAccount(a); await ws.select(peer)
    ws.draft.value = 'sent text'
    const request = ws.send()
    pending.resolve(); await request
    expect(ws.messages.value).toEqual([])
    expect(ws.draft.value).toBe('')
    expect(ws.error.value).toBe('history unavailable')
    expect(messages).toHaveBeenLastCalledWith(a, peer.id)
  })

  it('does not publish stale history or failures after disposal', async () => {
    const pending = deferred<ImMessage[]>()
    const ws = createImWorkspace(client({ messages: () => pending.promise }))
    await ws.setAccount(a)
    const request = ws.select(peer)
    ws.dispose(); pending.reject(new Error('late')); await request
    expect(ws.messages.value).toEqual([])
    expect(ws.error.value).toBe('')
  })
})
