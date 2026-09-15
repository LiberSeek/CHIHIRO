import { describe, expect, it } from 'vitest'
import {
  formatBubbleTime,
  formatChatDateChip,
  isSameCalendarDay,
  shouldShowChatDateChip,
} from './message-time'

const at = (year: number, month: number, day: number, hour = 0, minute = 0) =>
  Math.floor(new Date(year, month - 1, day, hour, minute, 0).getTime() / 1000)

const now = new Date(2026, 8, 15, 18, 30, 0)

describe('message time display', () => {
  it('formats in-bubble clocks as HH:MM', () => {
    expect(formatBubbleTime(at(2026, 9, 15, 14, 53))).toBe('14:53')
    expect(formatBubbleTime(at(2026, 9, 15, 9, 5))).toBe('09:05')
    expect(formatBubbleTime(at(2026, 9, 15, 14, 53) * 1000)).toBe('14:53')
    expect(formatBubbleTime(undefined)).toBe('')
  })

  it('labels date chips as 今天 / 昨天 / 周X / date', () => {
    expect(formatChatDateChip(at(2026, 9, 15, 20, 41), now)).toBe('今天')
    expect(formatChatDateChip(at(2026, 9, 14, 23, 59), now)).toBe('昨天')
    expect(formatChatDateChip(at(2026, 9, 13, 1, 0), now)).toBe('周日')
    expect(formatChatDateChip(at(2026, 9, 11, 12, 0), now)).toBe('周五')
    expect(formatChatDateChip(at(2026, 9, 9, 8, 0), now)).toBe('周三')
    expect(formatChatDateChip(at(2026, 9, 8, 8, 0), now)).toBe('9月8日')
    expect(formatChatDateChip(at(2026, 8, 1, 8, 0), now)).toBe('8月1日')
    expect(formatChatDateChip(at(2025, 9, 15, 8, 0), now)).toBe('2025年9月15日')
  })

  it('treats mixed second/ms stamps on the same local day as one day', () => {
    const morning = at(2026, 9, 15, 1, 0)
    const night = at(2026, 9, 15, 23, 59) * 1000
    expect(isSameCalendarDay(morning, night)).toBe(true)
    expect(isSameCalendarDay(morning, at(2026, 9, 16, 0, 0))).toBe(false)
  })

  it('shows a date chip on the first message and when the day changes', () => {
    expect(shouldShowChatDateChip(undefined, at(2026, 9, 15, 10, 0))).toBe(true)
    expect(shouldShowChatDateChip(at(2026, 9, 15, 10, 0), at(2026, 9, 15, 18, 0))).toBe(false)
    expect(shouldShowChatDateChip(at(2026, 9, 14, 23, 59), at(2026, 9, 15, 0, 1))).toBe(true)
    expect(shouldShowChatDateChip(at(2026, 9, 15, 10, 0), at(2026, 9, 15, 10, 1), true)).toBe(true)
  })
})
