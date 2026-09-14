import { describe, expect, it, vi } from 'vitest'
import { accountId } from '../../../contracts'
import { AccountSessionManager, type AccountSessionConnection, type AccountSessionEvent } from '../../../services/account-session-manager'
import { NativeAccountBinding } from './account-binding'

function fixture() {
  const callbacks = new Set<(event: AccountSessionEvent) => void>()
  const replies: ((value: unknown) => void)[] = []
  const connection: AccountSessionConnection = {
    request: <T>() => new Promise<T>(resolve => replies.push(value => resolve(value as T))),
    subscribe: listener => { callbacks.add(listener); return () => callbacks.delete(listener) },
    close: vi.fn(),
  }
  const manager = new AccountSessionManager(() => connection)
  return { manager, replies, emit: (event: AccountSessionEvent) => [...callbacks].forEach(fn => fn(event)) }
}

const context = { id: accountId('qq:10001'), label: 'A', platform: 'qq' as const, status: 'online' as const }
const handlers = () => ({ dispatch: vi.fn(), error: vi.fn(), closed: vi.fn() })

describe('native account binding', () => {
  it('drops late responses and events after the view is invalidated', async () => {
    const f = fixture()
    const h = handlers()
    const binding = new NativeAccountBinding(await f.manager.connect(context), h)
    binding.send('get_friend_list', {}, 'getFriendList')
    await Promise.resolve()
    binding.invalidate()
    f.replies[0]({ status: 'ok', data: ['old friend'], retcode: 0 })
    f.emit({ type: 'onebot.event', payload: { self_id: 10001, post_type: 'message' } })
    await vi.waitFor(() => expect(f.manager.cancelAllRequests(context.id)).toBe(0))
    expect(h.dispatch).not.toHaveBeenCalled()
    expect(h.error).not.toHaveBeenCalled()
  })

  it('rejects awaited old results so callers cannot use them after an account switch', async () => {
    const f = fixture()
    const binding = new NativeAccountBinding(await f.manager.connect(context), handlers())
    const pending = binding.request('get_msg', {})
    await Promise.resolve()
    binding.invalidate()
    f.replies[0]({ status: 'ok', data: 'stale', retcode: 0 })
    await expect(pending).rejects.toThrow('replaced or disconnected')
  })

  it('accepts only events owned by the bound account and invalidates on close', async () => {
    const f = fixture()
    const h = handlers()
    const binding = new NativeAccountBinding(await f.manager.connect(context), h)
    f.emit({ type: 'onebot.event', payload: { self_id: 10002 } })
    f.emit({ type: 'onebot.event', payload: { post_type: 'message' } })
    expect(h.dispatch).not.toHaveBeenCalled()
    const message = { self_id: 10001, post_type: 'message' }
    f.emit({ type: 'onebot.event', payload: message })
    expect(h.dispatch).toHaveBeenCalledWith(message)
    f.emit({ type: 'session.closed' })
    expect(binding.valid).toBe(false)
    expect(h.closed).toHaveBeenCalledOnce()
  })
})
