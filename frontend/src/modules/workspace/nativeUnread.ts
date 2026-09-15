import type { AccountId } from '@/contracts'

export type NativeUnreadNoticeMode = 'notify' | 'silent' | 'assist' | 'block'

export type NativeUnreadItem = {
  user_id?: number
  group_id?: number
  unread?: number
  new_msg?: boolean
  notice_mode?: NativeUnreadNoticeMode
}

export type NativeUnreadPeer = { peer: string; unread: number }

export interface NativeUnreadOwnerState {
  activeAccountId?: AccountId | null
  activeAccountOnline?: boolean
  readyAccountId?: AccountId | string | null
}

const quietModes = new Set<NativeUnreadNoticeMode>(['silent', 'assist', 'block'])

export function isQuietNoticeMode(mode?: NativeUnreadNoticeMode): boolean {
  return mode != null && quietModes.has(mode)
}

export function flattenSessionNotice(raw: unknown, uin?: string | number): Record<string, NativeUnreadNoticeMode> {
  const out: Record<string, NativeUnreadNoticeMode> = {}
  const take = (map: unknown) => {
    if (!map || typeof map !== 'object' || Array.isArray(map)) return
    for (const [key, value] of Object.entries(map as Record<string, unknown>)) {
      if (value === 'notify' || value === 'silent' || value === 'assist' || value === 'block') {
        out[String(key)] = value
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        take(value)
      }
    }
  }
  if (raw && typeof raw === 'object' && uin != null) {
    const nested = (raw as Record<string, unknown>)[String(uin)]
    take(nested && typeof nested === 'object' ? nested : raw)
  } else {
    take(raw)
  }
  return out
}

export function readAccountSessionNotice(accountId: string | null | undefined): Record<string, NativeUnreadNoticeMode> {
  if (!accountId || typeof localStorage === 'undefined') return {}
  try {
    const raw = JSON.parse(localStorage.getItem(`chihiro:im:${accountId}:options`) ?? '{}')
    const uin = String(accountId).replace(/^qq:/, '')
    return flattenSessionNotice(raw?.session_notice, uin)
  } catch {
    return {}
  }
}

export function isQuietUnreadSession(
  item: NativeUnreadItem,
  notice: Record<string, NativeUnreadNoticeMode> = {},
): boolean {
  const id = item.user_id ?? item.group_id
  const mode = item.notice_mode ?? (id != null ? notice[String(id)] : undefined)
  return isQuietNoticeMode(mode)
}

export function sessionUnreadCount(item: NativeUnreadItem): number {
  const unread = Math.max(0, Math.floor(Number(item.unread) || 0))
  if (unread > 0) return unread
  return item.new_msg === true ? 1 : 0
}

export function formatUnreadLabel(count: number): string {
  const n = Math.max(0, Math.floor(Number(count) || 0))
  return n > 99 ? '99+' : String(n)
}

export function filterUnreadPeers(
  peers: NativeUnreadPeer[] = [],
  notice: Record<string, NativeUnreadNoticeMode> = {},
): number {
  let total = 0
  for (const row of peers) {
    if (!row || isQuietNoticeMode(notice[String(row.peer)])) continue
    const n = Math.max(0, Math.floor(Number(row.unread) || 0))
    if (n > 0) total += n
  }
  return total
}

export function countNativeUnreadSessions(
  onMsgList: NativeUnreadItem[] = [],
  groupAssistList: NativeUnreadItem[] = [],
  notice: Record<string, NativeUnreadNoticeMode> = {},
): number {
  const seen = new Map<string, number>()
  const add = (item: NativeUnreadItem, quietList: boolean) => {
    if (quietList || isQuietUnreadSession(item, notice)) return
    const id = item.user_id ? `user:${item.user_id}` : item.group_id ? `group:${item.group_id}` : ''
    if (!id) return
    const n = sessionUnreadCount(item)
    if (n <= 0) return
    seen.set(id, Math.max(seen.get(id) || 0, n))
  }
  onMsgList.forEach((item) => add(item, false))
  groupAssistList.forEach((item) => add(item, true))
  let total = 0
  seen.forEach((n) => { total += n })
  return total
}

export function nativeUnreadOwnerAccountId(state: NativeUnreadOwnerState): AccountId | null {
  if (!state.activeAccountOnline || !state.activeAccountId) return null
  return state.readyAccountId === state.activeAccountId ? state.activeAccountId : null
}
