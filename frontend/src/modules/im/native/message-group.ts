import { isSameCalendarDay } from './message-time'

type GroupableMsg = {
  post_type?: string
  revoke?: boolean
  raw_message?: string
  time?: number
  message?: unknown[]
  sender?: { user_id?: string | number }
} | null | undefined

export function isGroupableMessage(item: GroupableMsg): boolean {
  if (!item || item.revoke) return false
  if (item.post_type && item.post_type !== 'message' && item.post_type !== 'message_sent') return false
  if (String(item.raw_message || '').includes('已删除')) return false
  if (!Array.isArray(item.message) || item.message.length === 0) return false
  return true
}

function senderId(item: GroupableMsg): string {
  return String(item?.sender?.user_id ?? '')
}

export function sameMessageGroup(prev: GroupableMsg, next: GroupableMsg): boolean {
  if (!isGroupableMessage(prev) || !isGroupableMessage(next)) return false
  const from = senderId(prev)
  if (!from || from !== senderId(next)) return false
  const timePrv = Number(prev?.time)
  const timeNow = Number(next?.time)
  if (!Number.isFinite(timePrv) || !Number.isFinite(timeNow)) return false
  return isSameCalendarDay(timePrv, timeNow)
}

export function messageGroupFlags<T extends GroupableMsg>(
  list: T[] = [],
  index: number,
): { firstInGroup: boolean, lastInGroup: boolean } {
  const cur = list[index]
  if (!isGroupableMessage(cur)) return { firstInGroup: true, lastInGroup: true }
  return {
    firstInGroup: !sameMessageGroup(list[index - 1], cur),
    lastInGroup: !sameMessageGroup(cur, list[index + 1]),
  }
}
