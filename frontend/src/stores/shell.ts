import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AccountContext, AccountId } from '../contracts'
import { accountId } from '../contracts'

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Read only the public account fields; runtime tokens never enter this store. */
export function parseRuntimeAccounts(value: unknown): { accounts: AccountContext[]; activeId: AccountId | null } {
  if (!record(value) || !record(value.accounts) || !Array.isArray(value.accounts.accounts)) {
    throw new Error('账号状态响应格式无效')
  }
  const ids = new Set<string>()
  const accounts: AccountContext[] = value.accounts.accounts.map((item: unknown) => {
    if (!record(item) || typeof item.id !== 'string' || !/^qq:\d+$/.test(item.id) || ids.has(item.id)) {
      throw new Error('账号状态包含无效或重复账号')
    }
    ids.add(item.id)
    const avatar = typeof item.avatar === 'string' && /^https?:\/\//.test(item.avatar) ? item.avatar : undefined
    const instanceId = typeof item.instanceId === 'string' && item.instanceId.trim() ? item.instanceId : undefined
    const unread = typeof item.unread === 'number' && Number.isFinite(item.unread) ? Math.max(0, Math.floor(item.unread)) : undefined
    return {
      id: accountId(item.id),
      label: [item.label, item.nickname, item.id].find((label): label is string => typeof label === 'string' && Boolean(label.trim()))!,
      ...(avatar ? { avatar } : {}),
      ...(instanceId ? { instanceId } : {}),
      platform: 'qq',
      status: item.online === true ? 'online' : 'offline',
      ...(item.botEnabled === true ? { botEnabled: true } : {}),
      ...(item.botWired === true ? { botWired: true } : {}),
      ...(unread !== undefined ? { unread } : {}),
    }
  })
  const selected = value.accounts.activeId
  return { accounts, activeId: typeof selected === 'string' && ids.has(selected) ? accountId(selected) : null }
}

function messageFrom(value: unknown, fallback: string): string {
  return record(value) && typeof value.message === 'string' && value.message.trim() ? value.message : fallback
}

export interface RuntimeClient {
  id: string
  name: string
  badge: string
  enabled: boolean
  hint?: string
}

export function parseRuntimeClients(value: unknown): RuntimeClient[] {
  if (!record(value) || !Array.isArray(value.clients)) throw new Error('客户端列表响应格式无效')
  return value.clients.flatMap((item): RuntimeClient[] => {
    if (!record(item) || typeof item.id !== 'string' || typeof item.name !== 'string') return []
    return [{
      id: item.id,
      name: item.name,
      badge: typeof item.badge === 'string' && item.badge ? item.badge : item.name.slice(0, 2),
      enabled: item.enabled === true,
      ...(typeof item.hint === 'string' && item.hint ? { hint: item.hint } : {}),
    }]
  })
}

export const useShellStore = defineStore('shell', () => {
  const activeAccountId = ref<AccountId | null>(null)
  const accounts = ref<AccountContext[]>([])
  const loading = ref(false)
  const adding = ref(false)
  const accountAction = ref(false)
  const cancelingLogin = ref(false)
  const removingAccountId = ref<AccountId | null>(null)
  const error = ref('')
  const runtimePhase = ref('idle')
  const runtimeMessage = ref('')
  const pendingAdd = ref(false)
  const qrReady = ref(false)
  const qrVersion = ref(0)
  const clients = ref<RuntimeClient[]>([{ id: 'qq', name: 'QQ', badge: 'QQ', enabled: true }])
  const activeAccount = computed(() => accounts.value.find(account => account.id === activeAccountId.value) ?? null)
  let requestVersion = 0
  let selectionVersion = 0
  let loginVersion = 0
  let controller: AbortController | undefined
  const liveUnread = new Map<AccountId, number>()

  function dropLiveUnread(id: AccountId | null | undefined) {
    if (id) liveUnread.delete(id)
  }

  function applyLiveUnread(account: AccountContext): AccountContext {
    if (account.id !== activeAccountId.value || !liveUnread.has(account.id)) return account
    const unread = liveUnread.get(account.id) || 0
    if (unread > 0) return account.unread === unread ? account : { ...account, unread }
    if (account.unread === undefined) return account
    const next = { ...account }
    delete next.unread
    return next
  }

  function sameAccount(a: AccountContext, b: AccountContext) {
    return a.id === b.id &&
      a.label === b.label &&
      a.avatar === b.avatar &&
      a.instanceId === b.instanceId &&
      a.platform === b.platform &&
      a.status === b.status &&
      a.botEnabled === b.botEnabled &&
      a.botWired === b.botWired &&
      a.unread === b.unread
  }

  function mergeAccounts(nextAccounts: AccountContext[]) {
    const currentById = new Map(accounts.value.map(account => [account.id, account]))
    const next = nextAccounts.map(account => {
      const current = currentById.get(account.id)
      const withRuntimeUnread = account.unread === undefined && current?.unread ? { ...account, unread: current.unread } : account
      const withLocalUnread = applyLiveUnread(withRuntimeUnread)
      return current && sameAccount(current, withLocalUnread) ? current : withLocalUnread
    })
    const unchanged = next.length === accounts.value.length &&
      next.every((account, index) => account === accounts.value[index])
    if (!unchanged) accounts.value = next
  }

  function applyRuntimeState(value: unknown, preserveSelection = true, options: { preserveLoginState?: boolean } = {}) {
    const state = parseRuntimeAccounts(value)
    if (record(value) && !options.preserveLoginState) {
      runtimePhase.value = typeof value.phase === 'string' ? value.phase : 'idle'
      runtimeMessage.value = typeof value.message === 'string' ? value.message : ''
      pendingAdd.value = value.pendingAdd === true
      if (record(value.qr)) {
        qrReady.value = value.qr.exists === true
        qrVersion.value = typeof value.qr.mtime === 'number' ? value.qr.mtime : 0
      } else {
        qrReady.value = false
        qrVersion.value = 0
      }
    }
    mergeAccounts(state.accounts)
    const selectedStillExists = state.accounts.some(account => account.id === activeAccountId.value)
    if (!preserveSelection || !selectedStillExists) {
      dropLiveUnread(activeAccountId.value)
      activeAccountId.value = state.activeId ?? state.accounts[0]?.id ?? null
    }
    return state
  }

  // Selection is local to this browser; API calls carry their explicit account.
  function selectAccount(id: AccountId | null) {
    if (id !== null && !accounts.value.some(account => account.id === id)) return
    if (activeAccountId.value !== id) dropLiveUnread(activeAccountId.value)
    ++selectionVersion
    activeAccountId.value = id
  }

  async function refreshAccounts() {
    const version = ++requestVersion
    const selectionAtStart = selectionVersion
    controller?.abort()
    controller = new AbortController()
    loading.value = true
    error.value = ''
    try {
      const response = await fetch('/api/runtime/state', { signal: controller.signal, cache: 'no-store' })
      if (!response.ok) throw new Error(`无法加载账号（HTTP ${response.status}）`)
      const body: unknown = await response.json()
      if (version !== requestVersion) return
      const selectionBeforeApply = activeAccountId.value
      const staleNewLoginState = adding.value && pendingAdd.value && record(body) && body.pendingAdd !== true
      const state = applyRuntimeState(body, true, { preserveLoginState: staleNewLoginState || cancelingLogin.value })
      const selectedStillExists = state.accounts.some(account => account.id === selectionBeforeApply)
      if (!selectedStillExists) {
        activeAccountId.value = selectionAtStart !== selectionVersion && activeAccountId.value === null
          ? null : state.activeId ?? state.accounts[0]?.id ?? null
      }
    } catch (cause) {
      if (version === requestVersion) error.value = cause instanceof Error ? cause.message : '无法加载账号'
    } finally {
      if (version === requestVersion) { loading.value = false; controller = undefined }
    }
  }

  function setAccountUnread(id: AccountId, count: number) {
    const unread = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0))
    const index = accounts.value.findIndex(account => account.id === id)
    if (index < 0) return
    liveUnread.set(id, unread)
    if ((accounts.value[index].unread ?? 0) === unread) return
    const next = accounts.value.slice()
    next[index] = { ...next[index], ...(unread > 0 ? { unread } : { unread: undefined }) }
    accounts.value = next
  }

  async function refreshClients() {
    try {
      const response = await fetch('/api/runtime/clients', { cache: 'no-store' })
      if (!response.ok) throw new Error(`无法加载客户端（HTTP ${response.status}）`)
      const list = parseRuntimeClients(await response.json())
      if (list.length) clients.value = list
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '无法加载客户端'
    }
  }

  async function addAccount(client = 'qq') {
    if (adding.value || accountAction.value) return
    const version = ++loginVersion
    adding.value = true
    pendingAdd.value = true
    runtimePhase.value = 'starting'
    runtimeMessage.value = '正在启动 QQ 登录'
    qrReady.value = false
    qrVersion.value = 0
    error.value = ''
    try {
      const response = await fetch('/api/runtime/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client, mode: 'new' }),
      })
      const body: unknown = await response.json().catch(() => ({}))
      if (version !== loginVersion) return
      if (!response.ok) throw new Error(record(body) && typeof body.message === 'string' ? body.message : `无法添加账号（HTTP ${response.status}）`)
      const state = applyRuntimeState(body, false)
      activeAccountId.value = state.activeId ?? state.accounts.at(-1)?.id ?? null
    } catch (cause) {
      if (version === loginVersion) {
        error.value = cause instanceof Error ? cause.message : '无法添加账号'
        pendingAdd.value = false
        runtimePhase.value = 'idle'
        runtimeMessage.value = ''
      }
    } finally {
      if (version === loginVersion) adding.value = false
    }
  }

  async function reloginAccount(id: AccountId, refreshQr = false) {
    if (adding.value || accountAction.value) return
    const version = ++loginVersion
    accountAction.value = true
    error.value = ''
    selectAccount(id)
    try {
      const response = await fetch('/api/runtime/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client: 'qq', uin: String(id).replace(/^qq:/, ''), ...(refreshQr ? { refreshQr: true } : {}) }),
      })
      const body: unknown = await response.json().catch(() => ({}))
      if (version !== loginVersion) return
      if (!response.ok) throw new Error(messageFrom(body, `无法登录账号（HTTP ${response.status}）`))
      applyRuntimeState(body)
    } catch (cause) {
      if (version === loginVersion) error.value = cause instanceof Error ? cause.message : '无法登录账号'
    } finally {
      if (version === loginVersion) accountAction.value = false
    }
  }

  async function refreshLoginQr() {
    if (accountAction.value) return
    const version = ++loginVersion
    accountAction.value = true
    error.value = ''
    try {
      const response = await fetch('/api/runtime/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client: 'qq', refreshQr: true }),
      })
      const body: unknown = await response.json().catch(() => ({}))
      if (version !== loginVersion) return
      if (!response.ok) throw new Error(messageFrom(body, `无法刷新二维码（HTTP ${response.status}）`))
      applyRuntimeState(body)
    } catch (cause) {
      if (version === loginVersion) error.value = cause instanceof Error ? cause.message : '无法刷新二维码'
    } finally {
      if (version === loginVersion) accountAction.value = false
    }
  }

  async function removeAccount(id: AccountId) {
    if (accountAction.value) return false
    accountAction.value = true
    removingAccountId.value = id
    error.value = ''
    try {
      const response = await fetch('/api/runtime/accounts/remove', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      })
      const body: unknown = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(messageFrom(body, `无法退出账号（HTTP ${response.status}）`))
      applyRuntimeState(body, false)
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '无法退出账号'
      return false
    } finally {
      accountAction.value = false
      removingAccountId.value = null
    }
  }

  async function cancelLogin() {
    if (runtimePhase.value === 'cancelling') return
    ++loginVersion
    adding.value = false
    accountAction.value = true
    cancelingLogin.value = true
    runtimePhase.value = 'cancelling'
    runtimeMessage.value = '正在取消登录…'
    qrReady.value = false
    error.value = ''
    try {
      const response = await fetch('/api/runtime/login/cancel', { method: 'POST' })
      const body: unknown = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(messageFrom(body, `无法取消登录（HTTP ${response.status}）`))
      applyRuntimeState(body)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '无法取消登录'
    } finally {
      adding.value = false
      accountAction.value = false
      cancelingLogin.value = false
    }
  }

  function cancelRefresh() {
    ++requestVersion
    controller?.abort()
    controller = undefined
    loading.value = false
  }

  return {
    activeAccountId, activeAccount, accounts, loading, adding, accountAction, cancelingLogin, removingAccountId, error,
    runtimePhase, runtimeMessage, pendingAdd, qrReady, qrVersion, clients,
    selectAccount, setAccountUnread, applyRuntimeState, refreshAccounts, refreshClients, addAccount, reloginAccount, refreshLoginQr, removeAccount, cancelLogin, cancelRefresh,
  }
})
