import { describe, expect, it } from 'vitest'
import { accountId, type AccountContext } from '@/contracts'
import {
  accountTitle,
  accountUnreadLabel,
  canCloseExitDialog,
  canOpenNapCatSettings,
  clampAccountMenuPosition,
  shouldCloseExitDialogForKey,
  shouldCloseImSettingsForKey,
  shouldShowAccountUnread,
  shouldShowBotBadge,
} from './account-ui'

function account(overrides: Partial<AccountContext> = {}): AccountContext {
  return {
    id: accountId('qq:10001'),
    label: '千寻测试号',
    platform: 'qq',
    status: 'online',
    ...overrides,
  }
}

describe('account rail UI contract', () => {
  it('formats account title, unread badge and bot badge from account state', () => {
    const value = account({ unread: 128, botEnabled: true })

    expect(accountTitle(value)).toBe('千寻测试号 · QQ · 在线 · Bot · 右键管理')
    expect(shouldShowAccountUnread(value)).toBe(true)
    expect(accountUnreadLabel(value)).toBe('99+')
    expect(shouldShowBotBadge(value)).toBe(true)
  })

  it('hides empty unread and bot badges', () => {
    const value = account({ unread: 0, botEnabled: false, status: 'offline' })

    expect(accountTitle(value)).toBe('千寻测试号 · QQ · 离线 · 右键管理')
    expect(shouldShowAccountUnread(value)).toBe(false)
    expect(accountUnreadLabel(value)).toBe('0')
    expect(shouldShowBotBadge(value)).toBe(false)
  })

  it('keeps NapCat settings scoped to QQ accounts', () => {
    expect(canOpenNapCatSettings(account({ platform: 'qq' }))).toBe(true)
    expect(canOpenNapCatSettings(account({ platform: 'telegram' as never }))).toBe(false)
    expect(canOpenNapCatSettings(account({ platform: 'wechat' as never }))).toBe(false)
  })

  it('clamps context menu position inside the shell viewport', () => {
    expect(clampAccountMenuPosition(900, 700, { width: 1000, height: 760 })).toEqual({ x: 804, y: 644 })
    expect(clampAccountMenuPosition(120, 80, { width: 1000, height: 760 })).toEqual({ x: 120, y: 80 })
  })

  it('allows ESC and backdrop close only while account exit is idle', () => {
    expect(canCloseExitDialog(false)).toBe(true)
    expect(canCloseExitDialog(true)).toBe(false)
    expect(shouldCloseExitDialogForKey('Escape', true, false)).toBe(true)
    expect(shouldCloseExitDialogForKey('Escape', true, true)).toBe(false)
    expect(shouldCloseExitDialogForKey('Enter', true, false)).toBe(false)
    expect(shouldCloseExitDialogForKey('Escape', false, false)).toBe(false)
  })

  it('allows ESC to close only the IM settings route', () => {
    expect(shouldCloseImSettingsForKey('Escape', 'im', '1')).toBe(true)
    expect(shouldCloseImSettingsForKey('Enter', 'im', '1')).toBe(false)
    expect(shouldCloseImSettingsForKey('Escape', 'im', undefined)).toBe(false)
    expect(shouldCloseImSettingsForKey('Escape', 'agent', '1')).toBe(false)
  })
})
