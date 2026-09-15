import { describe, expect, it } from 'vitest'
import { isGroupableMessage, messageGroupFlags, sameMessageGroup } from './message-group'

const msg = (
  id: string,
  sender: string | number,
  time: number,
  extra: Record<string, unknown> = {},
) => ({
  message_id: id,
  post_type: 'message',
  time,
  message: [{ type: 'text', text: id }],
  sender: { user_id: sender },
  ...extra,
})

describe('message grouping', () => {
  it('skips notices, deletes, and empty bodies', () => {
    expect(isGroupableMessage({ post_type: 'notice', time: 1, message: [{ type: 'text', text: 'x' }], sender: { user_id: 1 } })).toBe(false)
    expect(isGroupableMessage(msg('a', 1, 1, { raw_message: '[已删除]' }))).toBe(false)
    expect(isGroupableMessage(msg('a', 1, 1, { message: [] }))).toBe(false)
    expect(isGroupableMessage(msg('a', 1, 1))).toBe(true)
  })

  it('groups consecutive messages from the same sender on the same calendar day', () => {
    const morning = Math.floor(new Date(2026, 8, 15, 10, 0, 0).getTime() / 1000)
    const night = Math.floor(new Date(2026, 8, 15, 23, 50, 0).getTime() / 1000)
    const nextDay = Math.floor(new Date(2026, 8, 16, 0, 1, 0).getTime() / 1000)
    expect(sameMessageGroup(msg('a', 1, morning), msg('b', 1, night))).toBe(true)
    expect(sameMessageGroup(msg('a', 1, night), msg('b', 1, nextDay))).toBe(false)
    expect(sameMessageGroup(msg('a', 1, morning), msg('b', 2, morning + 1))).toBe(false)
  })

  it('marks first/last in a streak and breaks on sender, day, or notices', () => {
    const day = Math.floor(new Date(2026, 8, 15, 10, 0, 0).getTime() / 1000)
    const nextDay = Math.floor(new Date(2026, 8, 16, 0, 1, 0).getTime() / 1000)
    const list = [
      msg('a', 1, day),
      msg('b', 1, day + 60),
      msg('c', 1, day + 120),
      msg('d', 2, day + 180),
      msg('e', 2, nextDay),
      { post_type: 'notice', time: nextDay + 10, message: [], sender: { user_id: 2 } },
      msg('f', 2, nextDay + 20),
    ]
    expect(list.map((_, i) => messageGroupFlags(list, i))).toEqual([
      { firstInGroup: true, lastInGroup: false },
      { firstInGroup: false, lastInGroup: false },
      { firstInGroup: false, lastInGroup: true },
      { firstInGroup: true, lastInGroup: true },
      { firstInGroup: true, lastInGroup: true },
      { firstInGroup: true, lastInGroup: true },
      { firstInGroup: true, lastInGroup: true },
    ])
  })
})
