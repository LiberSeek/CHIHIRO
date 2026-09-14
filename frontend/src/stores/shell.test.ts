import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { accountId } from '../contracts'
import { parseRuntimeAccounts, parseRuntimeClients, useShellStore } from './shell'

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
  it('maps runtime clients for the empty launcher', () => {
    expect(parseRuntimeClients({ clients: [
      { id: 'qq', name: 'QQ', badge: 'QQ', enabled: true, hint: '扫码登录', token: 'ignored' },
      { id: 'telegram', name: 'Telegram', enabled: false },
    ] })).toEqual([
      { id: 'qq', name: 'QQ', badge: 'QQ', enabled: true, hint: '扫码登录' },
      { id: 'telegram', name: 'Telegram', badge: 'Te', enabled: false },
    ])
  })

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

  it('keeps stable account objects when runtime polling returns unchanged state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(state())))
    const shell = useShellStore()
    await shell.refreshAccounts()
    const firstAccounts = shell.accounts
    const firstActive = shell.activeAccount

    await shell.refreshAccounts()

    expect(shell.accounts).toBe(firstAccounts)
    expect(shell.activeAccount).toBe(firstActive)
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


  it('keeps unread counts account-scoped and sanitizes runtime values', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response({ accounts: { activeId: a, accounts: [
        { id: a, nickname: 'A', online: true, unread: 3.8 },
        { id: b, nickname: 'B', online: true, unread: -2 },
      ] } }))
      .mockResolvedValueOnce(response({ accounts: { activeId: a, accounts: [
        { id: a, nickname: 'A', online: true },
        { id: b, nickname: 'B', online: true },
      ] } })))
    const shell = useShellStore()

    await shell.refreshAccounts()
    expect(shell.accounts.find(account => account.id === a)?.unread).toBe(3)
    expect(shell.accounts.find(account => account.id === b)?.unread).toBe(0)

    shell.setAccountUnread(b, 12)
    await shell.refreshAccounts()
    expect(shell.accounts.find(account => account.id === a)?.unread).toBe(3)
    expect(shell.accounts.find(account => account.id === b)?.unread).toBe(12)
  })

  it('starts a new QQ account and adopts the returned selection', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(state(b)))
    vi.stubGlobal('fetch', fetcher)
    const shell = useShellStore()
    await shell.addAccount()
    expect(fetcher).toHaveBeenCalledWith('/api/runtime/start', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ client: 'qq', mode: 'new' }),
    }))
    expect(shell.activeAccountId).toBe(b)
    expect(shell.adding).toBe(false)
  })

  it('enters a clean pending-new-account state before the start response returns', async () => {
    const start = deferred<Response>()
    const staleLoggedInState = { ...state(), phase: 'ready', message: '已登录 Name qq:123', qr: { exists: true, mtime: 1 } }
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(staleLoggedInState))
      .mockReturnValueOnce(start.promise)
      .mockResolvedValueOnce(response(staleLoggedInState))
    vi.stubGlobal('fetch', fetcher)
    const shell = useShellStore()
    await shell.refreshAccounts()

    const pending = shell.addAccount('qq')

    expect(shell.adding).toBe(true)
    expect(shell.pendingAdd).toBe(true)
    expect(shell.runtimePhase).toBe('starting')
    expect(shell.runtimeMessage).toBe('正在启动 QQ 登录')
    expect(shell.qrReady).toBe(false)

    await shell.refreshAccounts()
    expect(shell.pendingAdd).toBe(true)
    expect(shell.runtimeMessage).toBe('正在启动 QQ 登录')
    expect(shell.qrReady).toBe(false)

    start.resolve(response(state(b)))
    await pending
    expect(shell.activeAccountId).toBe(b)
    expect(shell.adding).toBe(false)
  })

  it('relogs and removes an account through runtime lifecycle endpoints', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(state()))
      .mockResolvedValueOnce(response(state(b)))
    vi.stubGlobal('fetch', fetcher)
    const shell = useShellStore()
    await shell.reloginAccount(a, true)
    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/runtime/start', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ client: 'qq', uin: '123', refreshQr: true }),
    }))
    expect(await shell.removeAccount(a)).toBe(true)
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/runtime/accounts/remove', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ id: a }),
    }))
    expect(shell.activeAccountId).toBe(b)
  })

  it('marks the account removal action while the runtime endpoint is pending', async () => {
    const removal = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(removal.promise))
    const shell = useShellStore()

    const pending = shell.removeAccount(a)

    expect(shell.accountAction).toBe(true)
    expect(shell.removingAccountId).toBe(a)
    removal.resolve(response(state(b)))
    expect(await pending).toBe(true)
    expect(shell.accountAction).toBe(false)
    expect(shell.removingAccountId).toBeNull()
  })

  it('cancels login and ignores the late start response', async () => {
    const start = deferred<Response>()
    const fetcher = vi.fn()
      .mockReturnValueOnce(start.promise)
      .mockResolvedValueOnce(response({ ...state(), phase: 'idle', pendingAdd: false }))
    vi.stubGlobal('fetch', fetcher)
    const shell = useShellStore()
    const pending = shell.addAccount()
    const cancel = shell.cancelLogin()
    expect(shell.cancelingLogin).toBe(true)
    expect(shell.runtimePhase).toBe('cancelling')
    expect(shell.runtimeMessage).toBe('正在取消登录…')
    await cancel
    start.resolve(response({ ...state(b), phase: 'ready', pendingAdd: false })); await pending
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/runtime/login/cancel', { method: 'POST' })
    expect(shell.activeAccountId).toBe(a)
    expect(shell.adding).toBe(false)
    expect(shell.cancelingLogin).toBe(false)
  })
})
