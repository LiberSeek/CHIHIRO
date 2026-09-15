import type { AccountId } from '@/contracts'

export type NativeUnreadItem = { user_id?: number; group_id?: number; unread?: number; new_msg?: boolean }

export interface NativeUnreadOwnerState {
  activeAccountId?: AccountId | null
  activeAccountOnline?: boolean
  readyAccountId?: AccountId | string | null
}

export function countNativeUnreadSessions(
  onMsgList: NativeUnreadItem[] = [],
  groupAssistList: NativeUnreadItem[] = [],
  explicitCount = 0,
): number {
  const counted = Math.max(0, Number(explicitCount) || 0)
  const seen = new Map<string, number>()
  const add = (item: NativeUnreadItem) => {
    const id = item.user_id ? `user:${item.user_id}` : item.group_id ? `group:${item.group_id}` : ''
    if (!id) return
    const unread = Math.max(0, Number(item.unread) || 0)
    const n = unread > 0 ? unread : item.new_msg === true ? 1 : 0
    if (n <= 0) return
    seen.set(id, Math.max(seen.get(id) || 0, n))
  }
  onMsgList.forEach(add)
  groupAssistList.forEach(add)
  let total = 0
  seen.forEach((n) => { total += n })
  return Math.max(counted, total)
}

export function nativeUnreadOwnerAccountId(state: NativeUnreadOwnerState): AccountId | null {
  if (!state.activeAccountOnline || !state.activeAccountId) return null
  return state.readyAccountId === state.activeAccountId ? state.activeAccountId : null
}
