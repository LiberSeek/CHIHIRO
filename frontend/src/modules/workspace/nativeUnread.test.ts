import { describe, expect, it } from 'vitest'
import { accountId } from '@/contracts'
import {
  countNativeUnreadSessions,
  filterUnreadPeers,
  flattenSessionNotice,
  formatUnreadLabel,
  isQuietUnreadSession,
  nativeUnreadOwnerAccountId,
} from './nativeUnread'

describe('native IM unread ownership', () => {
  it('sums alerting unread and ignores silent / group-assist sessions', () => {
    expect(countNativeUnreadSessions([
      { user_id: 10001, unread: 2 },
      { user_id: 10001, unread: 3 },
      { user_id: 10002, unread: 47, notice_mode: 'silent' },
      { group_id: 20001, unread: 4, notice_mode: 'notify' },
      { group_id: 20002, unread: 5, notice_mode: 'assist' },
      { group_id: 20005, unread: 0 },
    ], [
      { group_id: 20003, unread: 8, notice_mode: 'assist' },
      { group_id: 20004, unread: 1 },
    ])).toBe(7)
  })

  it('does not let muted-only unread create an AppShell badge', () => {
    expect(countNativeUnreadSessions(
      [{ user_id: 10001, unread: 5, notice_mode: 'silent' }],
      [{ group_id: 20001, unread: 9, notice_mode: 'assist' }],
    )).toBe(0)
    expect(isQuietUnreadSession({ notice_mode: 'silent' })).toBe(true)
    expect(isQuietUnreadSession({ notice_mode: 'assist' })).toBe(true)
    expect(isQuietUnreadSession({ notice_mode: 'notify' })).toBe(false)
  })

  it('filters runtime peer unread with session notice', () => {
    expect(filterUnreadPeers([
      { peer: '20001', unread: 4 },
      { peer: '20002', unread: 7 },
      { peer: '30001', unread: 1 },
    ], flattenSessionNotice({ 123: { 20001: 'silent', 20002: 'assist' } }, 123))).toBe(1)
  })

  it('caps unread labels at 99+', () => {
    expect(formatUnreadLabel(0)).toBe('0')
    expect(formatUnreadLabel(99)).toBe('99')
    expect(formatUnreadLabel(100)).toBe('99+')
    expect(formatUnreadLabel(128)).toBe('99+')
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
