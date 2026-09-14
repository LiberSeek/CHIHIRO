import { describe, expect, it } from 'vitest'
import { accountId } from '@/contracts'
import { countNativeUnreadSessions, nativeUnreadOwnerAccountId } from './nativeUnread'

describe('native IM unread ownership', () => {
  it('counts unique unread sessions across direct and group-assist lists', () => {
    expect(countNativeUnreadSessions([
      { user_id: 10001, unread: 2 },
      { user_id: 10001, unread: 3 },
      { group_id: 20001, new_msg: true },
      { group_id: 20002, unread: 0 },
    ], [
      { group_id: 20001, unread: 8 },
      { group_id: 20003, unread: 1 },
    ], 1)).toBe(3)
  })

  it('keeps runtime-provided unread count when it is larger than session count', () => {
    expect(countNativeUnreadSessions([{ user_id: 10001, unread: 1 }], [], 9)).toBe(9)
  })

  it('allows publishing unread only for the ready active account', () => {
    const a = accountId('qq:10001')
    const b = accountId('qq:10002')
    expect(nativeUnreadOwnerAccountId({ activeAccountId: a, activeAccountOnline: true, readyAccountId: a })).toBe(a)
    expect(nativeUnreadOwnerAccountId({ activeAccountId: a, activeAccountOnline: true, readyAccountId: b })).toBeNull()
    expect(nativeUnreadOwnerAccountId({ activeAccountId: a, activeAccountOnline: false, readyAccountId: a })).toBeNull()
    expect(nativeUnreadOwnerAccountId({ activeAccountId: null, activeAccountOnline: true, readyAccountId: a })).toBeNull()
  })
})
