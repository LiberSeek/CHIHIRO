import { describe, expect, it } from 'vitest'
import { accountId } from '@/contracts'
import { resolveShellViewState, type ShellViewStateInput } from './shell-view-state'

const base: ShellViewStateInput = {
  routeName: 'im',
  routeSettings: undefined,
  runtimeBootstrapped: true,
  adding: false,
  pendingAdd: false,
  runtimePhase: 'idle',
  runtimeMessage: '',
  qrReady: false,
  cancelingLogin: false,
  activeAccount: null,
}

const onlineAccount = {
  id: accountId('qq:10001'),
  label: 'QQ 10001',
  platform: 'qq' as const,
  status: 'online' as const,
}

describe('shell view state', () => {
  it('shows boot loading instead of the empty launcher before runtime state is known', () => {
    const state = resolveShellViewState({ ...base, runtimeBootstrapped: false })

    expect(state.showRuntimeBootLoading).toBe(true)
    expect(state.showLoginPanel).toBe(false)
    expect(state.showEmptyLauncher).toBe(false)
  })

  it('shows the empty launcher only after runtime bootstraps with no account and no login work', () => {
    const state = resolveShellViewState(base)

    expect(state.showRuntimeBootLoading).toBe(false)
    expect(state.showLoginPanel).toBe(true)
    expect(state.showEmptyLauncher).toBe(true)
    expect(state.loginMessage).toBe('点击左侧 + 添加并登录 QQ 账号')
  })

  it('keeps pending new-account login clean when runtime still reports the previous logged-in message', () => {
    const state = resolveShellViewState({
      ...base,
      adding: true,
      pendingAdd: true,
      runtimePhase: 'starting',
      runtimeMessage: '已登录 Raven',
      activeAccount: onlineAccount,
    })

    expect(state.loginInProgress).toBe(true)
    expect(state.showEmptyLauncher).toBe(false)
    expect(state.loginMessage).toBe('正在启动 QQ 登录')
  })

  it('surfaces cancel progress and restart hints', () => {
    expect(resolveShellViewState({
      ...base,
      activeAccount: { ...onlineAccount, status: 'offline' },
      runtimeMessage: '二维码过期，请刷新',
    }).loginNeedsRestart).toBe(true)

    const cancelling = resolveShellViewState({
      ...base,
      pendingAdd: true,
      runtimePhase: 'cancelling',
      cancelingLogin: true,
    })
    expect(cancelling.loginInProgress).toBe(true)
    expect(cancelling.loginMessage).toBe('正在取消登录…')
  })

  it('does not cover non-account routes or IM settings with the login panel', () => {
    expect(resolveShellViewState({ ...base, routeName: 'customers' }).showLoginPanel).toBe(false)
    expect(resolveShellViewState({ ...base, routeSettings: '1' }).showLoginPanel).toBe(false)
  })
})
