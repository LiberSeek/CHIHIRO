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
  const seen = new Set<string>()
  let sessions = 0
  const add = (item: NativeUnreadItem) => {
    const id = item.user_id ? `user:${item.user_id}` : item.group_id ? `group:${item.group_id}` : ''
    if (!id || seen.has(id)) return
    if ((Number(item.unread) || 0) <= 0 && item.new_msg !== true) return
    seen.add(id)
    sessions += 1
  }
  onMsgList.forEach(add)
  groupAssistList.forEach(add)
  return Math.max(counted, sessions)
}

export function nativeUnreadOwnerAccountId(state: NativeUnreadOwnerState): AccountId | null {
  if (!state.activeAccountOnline || !state.activeAccountId) return null
  return state.readyAccountId === state.activeAccountId ? state.activeAccountId : null
}
