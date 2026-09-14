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
    return {
      id: accountId(item.id),
      label: [item.label, item.nickname, item.id].find((label): label is string => typeof label === 'string' && Boolean(label.trim()))!,
      ...(avatar ? { avatar } : {}),
      platform: 'qq',
      status: item.online === true ? 'online' : 'offline',
    }
  })
  const selected = value.accounts.activeId
  return { accounts, activeId: typeof selected === 'string' && ids.has(selected) ? accountId(selected) : null }
}

function messageFrom(value: unknown, fallback: string): string {
  return record(value) && typeof value.message === 'string' && value.message.trim() ? value.message : fallback
}

export const useShellStore = defineStore('shell', () => {
  const activeAccountId = ref<AccountId | null>(null)
  const accounts = ref<AccountContext[]>([])
  const loading = ref(false)
  const adding = ref(false)
  const accountAction = ref(false)
  const error = ref('')
  const runtimePhase = ref('idle')
  const runtimeMessage = ref('')
  const pendingAdd = ref(false)
  const qrReady = ref(false)
  const qrVersion = ref(0)
  const activeAccount = computed(() => accounts.value.find(account => account.id === activeAccountId.value) ?? null)
  let requestVersion = 0
  let selectionVersion = 0
  let loginVersion = 0
  let controller: AbortController | undefined

  function applyRuntimeState(value: unknown, preserveSelection = true) {
    const state = parseRuntimeAccounts(value)
    if (record(value)) {
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
    accounts.value = state.accounts
    const selectedStillExists = state.accounts.some(account => account.id === activeAccountId.value)
    if (!preserveSelection || !selectedStillExists) activeAccountId.value = state.activeId ?? state.accounts[0]?.id ?? null
    return state
  }

  // Selection is local to this browser; API calls carry their explicit account.
  function selectAccount(id: AccountId | null) {
    if (id !== null && !accounts.value.some(account => account.id === id)) return
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
      const state = applyRuntimeState(body)
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

  async function addAccount() {
    if (adding.value || accountAction.value) return
    const version = ++loginVersion
    adding.value = true
    error.value = ''
    try {
      const response = await fetch('/api/runtime/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client: 'qq', mode: 'new' }),
      })
      const body: unknown = await response.json().catch(() => ({}))
      if (version !== loginVersion) return
      if (!response.ok) throw new Error(record(body) && typeof body.message === 'string' ? body.message : `无法添加账号（HTTP ${response.status}）`)
      const state = applyRuntimeState(body, false)
      activeAccountId.value = state.activeId ?? state.accounts.at(-1)?.id ?? null
    } catch (cause) {
      if (version === loginVersion) error.value = cause instanceof Error ? cause.message : '无法添加账号'
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
    }
  }

  async function cancelLogin() {
    if (runtimePhase.value === 'cancelling') return
    ++loginVersion
    adding.value = false
    accountAction.value = true
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
    }
  }

  function cancelRefresh() {
    ++requestVersion
    controller?.abort()
    controller = undefined
    loading.value = false
  }

  return {
    activeAccountId, activeAccount, accounts, loading, adding, accountAction, error,
    runtimePhase, runtimeMessage, pendingAdd, qrReady, qrVersion,
    selectAccount, refreshAccounts, addAccount, reloginAccount, refreshLoginQr, removeAccount, cancelLogin, cancelRefresh,
  }
})
