import type { AccountContext } from '@/contracts'

export interface AccountMenuPosition {
  x: number
  y: number
}

export function accountTitle(account: AccountContext): string {
  return `${account.label} · ${account.platform.toUpperCase()}${account.status === 'online' ? ' · 在线' : ' · 离线'}${account.botEnabled ? ' · Bot' : ''} · 右键管理`
}

export function shouldShowAccountUnread(account: AccountContext): boolean {
  return (account.unread ?? 0) > 0
}

export function accountUnreadLabel(account: AccountContext): string {
  const unread = Math.max(0, Math.floor(account.unread ?? 0))
  return unread > 99 ? '99+' : String(unread)
}

export function shouldShowBotBadge(account: AccountContext): boolean {
  return account.botEnabled === true
}

export function canOpenNapCatSettings(account: AccountContext): boolean {
  return account.platform === 'qq'
}

export function clampAccountMenuPosition(clientX: number, clientY: number, viewport: { width: number; height: number }): AccountMenuPosition {
  return {
    x: Math.min(clientX, viewport.width - 196),
    y: Math.min(clientY, viewport.height - 116),
  }
}

export function canCloseExitDialog(exitBusy: boolean): boolean {
  return !exitBusy
}

export function shouldCloseExitDialogForKey(key: string, exitOpen: boolean, exitBusy: boolean): boolean {
  return key === 'Escape' && exitOpen && canCloseExitDialog(exitBusy)
}
