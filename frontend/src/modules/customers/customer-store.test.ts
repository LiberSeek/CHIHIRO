import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { accountId } from '@/contracts'
import { useShellStore } from '@/stores/shell'
import { useCustomerStore } from './customer-store'

const first = { id: 'cust_1', accountId: 'qq:1', channel: 'qq', peerId: '100', displayName: '一号', tags: [], notes: '', factCount: 0, intentCount: 0, openIntentCount: 0 }
const second = { ...first, id: 'cust_2', accountId: 'qq:1', peerId: '200', displayName: '二号' }
const detail = (customer = first) => ({ ...customer, facts: [], intents: [], evidence: [] })
const list = (customers = [first]) => ({ customers, total: customers.length, limit: 100, offset: 0 })
const reply = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response
function deferred<T>() { let resolve!: (value: T) => void; return { promise: new Promise<T>(done => { resolve = done }), resolve } }

beforeEach(() => {
  setActivePinia(createPinia())
  const shell = useShellStore()
  shell.accounts = [
    { id: accountId('qq:1'), label: '一号账号', platform: 'qq', status: 'online' },
    { id: accountId('qq:2'), label: '二号账号', platform: 'qq', status: 'online' },
  ]
  shell.selectAccount(accountId('qq:1'))
})
afterEach(() => { useCustomerStore().clear(); vi.unstubAllGlobals() })

describe('customer store request safety', () => {
  it('aborts account-scoped work and ignores its late list response after account changes', async () => {
    const pending = deferred<Response>()
    const fetcher = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(reply(list([])))
    vi.stubGlobal('fetch', fetcher)
    const store = useCustomerStore()
    const firstLoad = store.loadList()
    const firstCall = fetcher.mock.calls.at(-1)
    expect(firstCall).toBeDefined()
    const firstSignal = firstCall![1]?.signal as AbortSignal
    useShellStore().selectAccount(accountId('qq:2'))
    expect(firstSignal.aborted).toBe(true)
    pending.resolve(reply(list([first])))
    await firstLoad
    await Promise.resolve()
    expect(store.activeAccountId).toBe('qq:2')
    expect(store.customers).toEqual([])
    const accountTwoCall = fetcher.mock.calls.find(([, init]) => new Headers(init?.headers).get('x-chihiro-account') === 'qq:2')
    expect(accountTwoCall).toBeDefined()
  })

  it('does not apply a late customer response after selecting another customer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(list([first, second]))))
    const store = useCustomerStore()
    await store.loadList()
    const pending = deferred<Response>()
    const fetcher = vi.mocked(fetch)
    fetcher.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(reply(detail(second)))
    const openingFirst = store.select(first.id)
    const detailCall = fetcher.mock.calls.at(-1)
    expect(detailCall).toBeDefined()
    const oldSignal = detailCall![1]?.signal as AbortSignal
    await store.select(second.id)
    expect(oldSignal.aborted).toBe(true)
    pending.resolve(reply(detail(first)))
    await openingFirst
    expect(store.selectedId).toBe(second.id)
    expect(store.customer?.id).toBe(second.id)
  })
})
