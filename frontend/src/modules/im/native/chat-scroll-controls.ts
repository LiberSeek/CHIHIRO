export function isAtChatBottom(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  slack = 16,
): boolean {
  return scrollTop + clientHeight + slack >= scrollHeight
}

export function nextJumpToBottomVisible(state: {
  atBottom: boolean
  delta: number
  visible: boolean
  threshold?: number
  settling?: boolean
  hasLatestBelow?: boolean
}): boolean {
  if (state.settling || state.atBottom) return false
  if (state.hasLatestBelow) return true
  const threshold = state.threshold ?? 4
  if (state.delta > threshold) return true
  if (state.delta < -threshold) return false
  return state.visible
}

export function sessionUnreadCount(session: { unread?: unknown } | null | undefined): number {
  const unread = Math.floor(Number(session?.unread) || 0)
  return Number.isFinite(unread) && unread > 0 ? unread : 0
}

export function firstUnreadMessage<T extends {
  message_id?: string | number
  user_id?: number | string
  sender?: { user_id?: number | string }
  post_type?: string
}>(
  list: T[] = [],
  unreadCount: number,
  selfUin?: number | string | null,
): T | null {
  const need = Math.max(0, Math.floor(Number(unreadCount) || 0))
  if (!need || !list.length) return null
  const self = selfUin == null || selfUin === '' ? null : Number(selfUin)
  const picked: T[] = []
  for (let i = list.length - 1; i >= 0 && picked.length < need; i--) {
    const item = list[i]
    if (!item) continue
    if (item.post_type && item.post_type !== 'message' && item.post_type !== 'message_sent') continue
    const sender = Number(item.sender?.user_id ?? item.user_id)
    if (self != null && Number.isFinite(self) && sender === self) continue
    picked.push(item)
  }
  return picked.length ? picked[picked.length - 1] : null
}

export function countIncomingTail<T extends {
  user_id?: number | string
  sender?: { user_id?: number | string }
  post_type?: string
}>(
  list: T[] = [],
  fromIndex: number,
  selfUin?: number | string | null,
): number {
  const start = Math.max(0, Math.floor(Number(fromIndex) || 0))
  if (!list.length || start >= list.length) return 0
  const self = selfUin == null || selfUin === '' ? null : Number(selfUin)
  let count = 0
  for (let i = start; i < list.length; i++) {
    const item = list[i]
    if (!item) continue
    if (item.post_type && item.post_type !== 'message' && item.post_type !== 'message_sent') continue
    const sender = Number(item.sender?.user_id ?? item.user_id)
    if (self != null && Number.isFinite(self) && sender === self) continue
    count++
  }
  return count
}

export function isElementAboveContainer(
  el: { getBoundingClientRect(): { top: number } } | null | undefined,
  container: { getBoundingClientRect(): { top: number } } | null | undefined,
  slack = 8,
): boolean {
  if (!el || !container) return true
  return el.getBoundingClientRect().top + slack < container.getBoundingClientRect().top
}
