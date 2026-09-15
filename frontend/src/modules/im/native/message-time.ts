const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const
const DAY_MS = 24 * 60 * 60 * 1000

function toMs(time: number): number {
  if (!Number.isFinite(time)) return NaN
  const digits = String(Math.trunc(Math.abs(time))).length
  return digits === 10 ? time * 1000 : time
}

function asDate(time: number): Date | null {
  const date = new Date(toMs(time))
  return Number.isNaN(date.getTime()) ? null : date
}

function startOfLocalDay(date: Date): number {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start.getTime()
}

export function isSameCalendarDay(a: number, b: number): boolean {
  const left = asDate(a)
  const right = asDate(b)
  if (!left || !right) return false
  return startOfLocalDay(left) === startOfLocalDay(right)
}

export function shouldShowChatDateChip(
  timePrv: number | undefined,
  timeNow: number,
  alwaysShow = false,
): boolean {
  if (alwaysShow) return true
  if (timePrv == undefined) return true
  return !isSameCalendarDay(timePrv, timeNow)
}

export function formatBubbleTime(time: number | undefined): string {
  if (time == undefined) return ''
  const date = asDate(time)
  if (!date) return ''
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

export function formatChatDateChip(time: number | undefined, now = new Date()): string {
  if (time == undefined) return ''
  const date = asDate(time)
  if (!date) return ''

  const today = startOfLocalDay(now)
  const day = startOfLocalDay(date)
  const dayDiff = Math.round((today - day) / DAY_MS)

  if (dayDiff <= 0) return '今天'
  if (dayDiff === 1) return '昨天'
  if (dayDiff > 1 && dayDiff < 7) return WEEKDAYS[date.getDay()]
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}
