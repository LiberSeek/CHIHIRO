import { describe, expect, it } from 'vitest'

import {
  applyRecentContactUnread,
  compareSessionsByRecency,
  getSessionTime,
  mergeContactListByKind,
  shouldApplySessionPreview,
} from './src/function/utils/sessionUtil'

describe('native IM session ordering', () => {
  it('normalizes second and millisecond timestamps', () => {
    expect(getSessionTime({ time: 1_700_000_000 })).toBe(1_700_000_000_000)
    expect(getSessionTime({ time: 1_700_000_000_000 })).toBe(1_700_000_000_000)
  })

  it('uses a stable id order when timestamps match', () => {
    const sessions = [
      { user_id: 20002, time: 1_700_000_000 },
      { user_id: 20001, time: 1_700_000_000_000 },
    ] as any[]

    expect(sessions.sort(compareSessionsByRecency).map(item => item.user_id)).toEqual([20001, 20002])
  })

  it('does not let old history replace a live preview', () => {
    expect(shouldApplySessionPreview(
      { time: 1_700_000_001_000, raw_msg: 'new' },
      { time: 1_700_000_000 },
    )).toBe(false)
    expect(shouldApplySessionPreview(
      { time: 1_700_000_000_000 },
      { time: 1_700_000_000 },
    )).toBe(true)
  })

  it('merges refreshed contacts without replacing active session objects', () => {
    const currentFriend = {
      user_id: 10001,
      nickname: 'old',
      raw_msg: 'latest',
      unread: 2,
      time: 1_700_000_001_000,
    }
    const currentGroup = { group_id: 20001, group_name: 'group' }
    const incomingFriend = { user_id: 10001, nickname: 'new', remark: 'new remark' }

    const merged = mergeContactListByKind(
      [currentFriend, currentGroup] as any[],
      [incomingFriend] as any[],
      'friend',
    )

    expect(merged.incoming[0]).toBe(currentFriend)
    expect(merged.all).toEqual([currentFriend, currentGroup])
    expect(currentFriend).toMatchObject({
      user_id: 10001,
      nickname: 'new',
      remark: 'new remark',
      raw_msg: 'latest',
      unread: 2,
      time: 1_700_000_001_000,
    })
  })

  it('applies recent-contact unread only when the field is present', () => {
    const session = { user_id: 10001, unread: 4, new_msg: true } as any
    applyRecentContactUnread(session, {})
    expect(session).toMatchObject({ unread: 4, new_msg: true })
    applyRecentContactUnread(session, { unread: undefined })
    expect(session).toMatchObject({ unread: 4, new_msg: true })
    applyRecentContactUnread(session, { unread: 7 })
    expect(session).toMatchObject({ unread: 7, new_msg: true })
    applyRecentContactUnread(session, { unread: 0 })
    expect(session).toMatchObject({ unread: 0, new_msg: false })
  })
})
