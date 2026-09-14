import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { accountId } from '@/contracts'
import { useShellStore } from '@/stores/shell'
import { useAssistantStore, assistantKey, type AssistantContext } from './session'

const a: AssistantContext = { accountId: 'qq:10001', type: 'private', peerId: '20001', title: 'A' }
const b: AssistantContext = { ...a, accountId: 'qq:10002', title: 'B' }
const group: AssistantContext = { ...a, type: 'group', title: 'Group' }
const state = { accounts: { accounts: [a, b].map(item => ({ id: item.accountId, botSessions: { 'private:20001': false } })) } }
const reply = (value: unknown, ok = true) => ({ ok, json: async () => value })
const snapshot = (target = a) => ({ sessions: [{ ...target, key: assistantKey(target), mode: 'ask', messages: [] }], drafts: [{
  ...target, sessionKey: assistantKey(target), id: `draft-${target.type}`, text: '候选回复', status: 'pending',
}] })
class Stream {
  static instances: Stream[] = []
  onmessage?: (event: { data: string }) => void
  onerror?: () => void
  closed = false
  constructor(readonly url: string) { Stream.instances.push(this) }
  close() { this.closed = true }
  emit(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }) }
}
async function flush() { await new Promise(resolve => setTimeout(resolve, 0)) }
beforeEach(() => {
  setActivePinia(createPinia())
  Stream.instances = []
  vi.stubGlobal('EventSource', Stream)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(state)))
  const shell = useShellStore()
  shell.accounts = [a, b].map(item => ({ id: accountId(item.accountId), label: item.title, platform: 'qq', status: 'online' }))
  shell.selectAccount(accountId(a.accountId))
})
afterEach(() => { useAssistantStore().clear(); vi.unstubAllGlobals() })

it('separates account and conversation kind, closes old streams and ignores late snapshots', async () => {
  const store = useAssistantStore()
  store.select(a); await flush()
  const old = Stream.instances[0]
  old.emit(snapshot())
  expect(store.currentDrafts[0].id).toBe('draft-private')
  store.select(group); await flush()
  expect(old.closed).toBe(true)
  old.emit(snapshot())
  expect(store.currentDrafts).toEqual([])
  Stream.instances[1].emit({ sessions: [...snapshot().sessions, ...snapshot(group).sessions, ...snapshot(b).sessions], drafts: [...snapshot().drafts, ...snapshot(group).drafts, ...snapshot(b).drafts] })
  expect(store.currentDrafts.map(item => item.id)).toEqual(['draft-group'])
  useShellStore().selectAccount(accountId(b.accountId))
  expect(store.context).toBeNull()
  expect(Stream.instances[1].closed).toBe(true)
})

it('approves once with immutable target context and keeps failed drafts visible', async () => {
  const store = useAssistantStore()
  store.select(a); await flush(); Stream.instances[0].emit(snapshot())
  let finish!: (value: unknown) => void
  const pending = new Promise(resolve => { finish = resolve })
  const fetcher = vi.mocked(fetch).mockReturnValueOnce(pending as Promise<Response>)
  const first = store.resolveDraft('draft-private', 'approve')
  await store.resolveDraft('draft-private', 'approve')
  expect(fetcher).toHaveBeenCalledTimes(2)
  const [url, options] = fetcher.mock.calls[1]
  expect(url).toBe('/api/runtime/agent/draft/approve')
  expect(JSON.parse(String(options?.body))).toMatchObject({ id: 'draft-private', ...a })
  finish(reply({ error: 'connection_lost' }, false)); await first
  expect(store.currentDrafts[0].status).toBe('pending')
  expect(store.error).toBe('connection_lost')
  expect(store.uncertainDrafts).toEqual(['draft-private'])
  await store.resolveDraft('draft-private', 'approve')
  expect(fetcher).toHaveBeenCalledTimes(2)
  Stream.instances[0].emit({ ...snapshot(), recentDrafts: [{ ...snapshot().drafts[0], status: 'unknown' }] })
  expect(store.currentDrafts[0].status).toBe('unknown')
  await store.resolveDraft('draft-private', 'approve')
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('does not apply a late approval result to a newly selected conversation', async () => {
  const store = useAssistantStore()
  store.select(a); await flush(); Stream.instances[0].emit(snapshot())
  let finish!: (value: unknown) => void
  vi.mocked(fetch).mockReturnValueOnce(new Promise<unknown>(resolve => { finish = resolve }) as Promise<Response>)
  const first = store.resolveDraft('draft-private', 'approve')
  store.select(group); await flush(); Stream.instances[1].emit(snapshot(group))
  finish(reply({ draft: { ...snapshot().drafts[0], status: 'sent' } })); await first
  expect(store.currentDrafts.map(item => item.id)).toEqual(['draft-group'])
  expect(store.busy).toBe(false)
})

it('reconciles an unknown delivery using its immutable account and conversation target', async () => {
  const store = useAssistantStore()
  store.select(a); await flush()
  Stream.instances[0].emit({ ...snapshot(), recentDrafts: [{ ...snapshot().drafts[0], status: 'unknown' }] })
  vi.mocked(fetch).mockResolvedValueOnce(reply({ draft: { ...snapshot().drafts[0], status: 'sent' } }) as Response)
  await store.resolveDelivery('draft-private', 'reconcile-sent')
  const [url, options] = vi.mocked(fetch).mock.calls[1]
  expect(url).toBe('/api/runtime/agent/draft/reconcile')
  expect(JSON.parse(String(options?.body))).toEqual({
    id: 'draft-private', accountId: a.accountId, sessionKey: assistantKey(a), type: 'private', peerId: a.peerId, resolution: 'sent',
  })
  expect(store.currentDrafts[0].status).toBe('sent')
})

it('deduplicates an in-flight retry and only applies the server draft transition', async () => {
  const store = useAssistantStore()
  store.select(a); await flush()
  Stream.instances[0].emit({ ...snapshot(), recentDrafts: [{ ...snapshot().drafts[0], status: 'failed' }] })
  let finish!: (value: unknown) => void
  const pending = new Promise(resolve => { finish = resolve })
  const fetcher = vi.mocked(fetch).mockReturnValueOnce(pending as Promise<Response>)
  const first = store.resolveDelivery('draft-private', 'retry')
  await store.resolveDelivery('draft-private', 'retry')
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(store.currentDrafts[0].status).toBe('failed')
  finish(reply({ draft: { ...snapshot().drafts[0], status: 'sending' } })); await first
  expect(store.currentDrafts[0].status).toBe('sending')
})

it('aborts a delivery reconciliation on account switch and ignores its stale response', async () => {
  const store = useAssistantStore()
  store.select(a); await flush()
  Stream.instances[0].emit({ ...snapshot(), recentDrafts: [{ ...snapshot().drafts[0], status: 'unknown' }] })
  let finish!: (value: unknown) => void
  const pending = new Promise(resolve => { finish = resolve })
  const fetcher = vi.mocked(fetch).mockReturnValueOnce(pending as Promise<Response>)
  const reconciling = store.resolveDelivery('draft-private', 'reconcile-sent')
  const options = fetcher.mock.calls[1][1]
  useShellStore().selectAccount(accountId(b.accountId))
  expect((options?.signal as AbortSignal).aborted).toBe(true)
  finish(reply({ draft: { ...snapshot().drafts[0], status: 'sent' } })); await reconciling
  expect(store.context).toBeNull()
  expect(store.currentDrafts).toEqual([])
})

it('rejects stale delivery actions after a stream snapshot changes their status', async () => {
  const store = useAssistantStore()
  store.select(a); await flush()
  Stream.instances[0].emit({ ...snapshot(), recentDrafts: [{ ...snapshot().drafts[0], status: 'unknown' }] })
  Stream.instances[0].emit({ ...snapshot(), recentDrafts: [{ ...snapshot().drafts[0], status: 'sent' }] })
  await store.resolveDelivery('draft-private', 'retry')
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  expect(store.currentDrafts[0].status).toBe('sent')
})

it('does not overwrite a newer stream delivery status with an older retry response', async () => {
  const store = useAssistantStore()
  store.select(a); await flush()
  Stream.instances[0].emit({ ...snapshot(), recentDrafts: [{ ...snapshot().drafts[0], status: 'failed' }] })
  let finish!: (value: Response) => void
  vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>(resolve => { finish = resolve }) as Promise<Response>)
  const retrying = store.resolveDelivery('draft-private', 'retry')
  Stream.instances[0].emit({ ...snapshot(), recentDrafts: [{ ...snapshot().drafts[0], status: 'sent' }] })
  finish(reply({ draft: { ...snapshot().drafts[0], status: 'sending' } }) as Response); await retrying
  expect(store.currentDrafts[0].status).toBe('sent')
})

it('never enables hosting when account changes during mode setup', async () => {
  const store = useAssistantStore()
  store.select(a); await flush()
  let finish!: (value: unknown) => void
  const fetcher = vi.mocked(fetch).mockReturnValueOnce(new Promise<unknown>(resolve => { finish = resolve }) as Promise<Response>)
  const enabling = store.setHosting(true)
  useShellStore().selectAccount(accountId(b.accountId))
  finish(reply(snapshot())); await enabling
  expect(fetcher.mock.calls.map(call => call[0])).not.toContain('/api/runtime/bot/session')
  expect(store.enabled).toBe(false)
})

it('sends operator text and customer quote separately without using QQ send', async () => {
  const store = useAssistantStore()
  store.select(a); await flush(); Stream.instances[0].emit(snapshot())
  store.instruction = '请建议回复'; store.quote = '客户原话'
  vi.mocked(fetch).mockResolvedValueOnce(reply({ ok: true }) as Response)
  await store.ask()
  const [url, options] = vi.mocked(fetch).mock.calls[1]
  expect(url).toBe('/api/runtime/agent/ask')
  expect(JSON.parse(String(options?.body))).toMatchObject({ ...a, text: '请建议回复', quote: '客户原话' })
  expect(store.instruction).toBe('')
  expect(store.quote).toBe('')
})

it('takes over before disabling hosting and keeps failures visible', async () => {
  const store = useAssistantStore()
  store.select(a); await flush(); Stream.instances[0].emit(snapshot())
  const fetcher = vi.mocked(fetch)
    .mockResolvedValueOnce(reply({ ...snapshot(), recentDrafts: [{ ...snapshot().drafts[0], status: 'superseded' }] }) as Response)
    .mockResolvedValueOnce(reply(state) as Response)
  await store.setHosting(false)
  expect(fetcher.mock.calls.slice(1).map(call => call[0])).toEqual(['/api/runtime/agent/takeover', '/api/runtime/bot/session'])
  expect(store.currentDrafts[0].status).toBe('superseded')
  expect(store.enabled).toBe(false)
})
