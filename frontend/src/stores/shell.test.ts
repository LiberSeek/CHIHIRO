import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { accountId } from '../contracts'
import { parseRuntimeAccounts, useShellStore } from './shell'

const a = accountId('qq:123'), b = accountId('qq:456')
const state = (activeId: string | null = a, ids = [a, b]) => ({ accounts: { activeId, accounts: ids.map(id => ({ id, nickname: `Name ${id}`, online: id === a, obToken: 'should-not-be-stored' })) } })
const response = (value: unknown) => ({ ok: true, json: async () => value }) as Response
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
beforeEach(() => setActivePinia(createPinia()))
afterEach(() => vi.unstubAllGlobals())

describe('runtime account shell', () => {
  it('maps the real online field, omits secrets, and rejects invalid identities', () => {
    const parsed = parseRuntimeAccounts(state())
    expect(parsed.accounts[0]).toEqual({ id: a, label: `Name ${a}`, platform: 'qq', status: 'online' })
    expect(parsed.accounts[1].status).toBe('offline')
    expect(() => parseRuntimeAccounts({ accounts: { accounts: [{ uin: '123' }] } })).toThrow()
    expect(() => parseRuntimeAccounts(state(a, [a, a]))).toThrow()
    expect(() => parseRuntimeAccounts({})).toThrow()
  })

  it('loads server selection then preserves a local choice across refresh', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(state())))
    const shell = useShellStore()
    await shell.refreshAccounts()
    expect(shell.activeAccountId).toBe(a)
    shell.selectAccount(b)
    await shell.refreshAccounts()
    expect(shell.activeAccount?.id).toBe(b)
    shell.selectAccount(accountId('qq:999'))
    expect(shell.activeAccountId).toBe(b)
  })

  it('does not overwrite a choice made while refreshing and replaces removed accounts', async () => {
    const pending = deferred<Response>()
    const fetcher = vi.fn().mockResolvedValueOnce(response(state())).mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response(state(a, [a])))
    vi.stubGlobal('fetch', fetcher)
    const shell = useShellStore()
    await shell.refreshAccounts()
    const request = shell.refreshAccounts()
    shell.selectAccount(b)
    pending.resolve(response(state())); await request
    expect(shell.activeAccountId).toBe(b)
    await shell.refreshAccounts()
    expect(shell.activeAccountId).toBe(a)
  })

  it('ignores superseded responses and reports malformed responses without clearing good data', async () => {
    const old = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(response(state(b))).mockResolvedValueOnce(response({ bad: true })))
    const shell = useShellStore()
    const request = shell.refreshAccounts()
    await shell.refreshAccounts()
    old.resolve(response(state(a, [a]))); await request
    expect(shell.activeAccountId).toBe(b)
    await shell.refreshAccounts()
    expect(shell.error).toContain('格式')
    expect(shell.accounts).toHaveLength(2)
  })

  it('cleans up pending work on unmount and handles an empty account list', async () => {
    const pending = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response(state(null, []))))
    const shell = useShellStore()
    const request = shell.refreshAccounts()
    shell.cancelRefresh()
    pending.resolve(response(state())); await request
    expect(shell.accounts).toEqual([])
    expect(shell.loading).toBe(false)
    await shell.refreshAccounts()
    expect(shell.activeAccountId).toBeNull()
    expect(shell.error).toBe('')
  })
})
