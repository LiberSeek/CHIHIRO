import { describe, expect, it } from 'vitest'

import { accountId } from '../contracts'

import {
  AccountSessionManager,
  AccountSessionSupersededError,
  type AccountSessionConnection,
  type AccountSessionEvent,
  type AccountSessionRequest,
} from './account-session-manager'

const account = (id: string) => ({
  id: accountId(id),
  label: id,
  platform: 'qq' as const,
  status: 'offline' as const,
})

interface FakeConnection extends AccountSessionConnection {
  events: (event: AccountSessionEvent) => void
  requestSignals: AbortSignal[]
  closeCount: number
}

function fakeConnection(): FakeConnection {
  const listeners = new Set<(event: AccountSessionEvent) => void>()
  const result: FakeConnection = {
    events: (event) => listeners.forEach((listener) => listener(event)),
    requestSignals: [],
    closeCount: 0,
    request: async <T>(_request: AccountSessionRequest, signal: AbortSignal) => {
      result.requestSignals.push(signal)
      return undefined as T
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    close: () => {
      result.closeCount += 1
    },
  }
  return result
}

describe('AccountSessionManager', () => {
  it('does not dispatch a send that was cancelled before the transport runs', async () => {
    const connection = fakeConnection()
    const manager = new AccountSessionManager(() => connection)
    const session = await manager.connect(account('a'))
    const request = session.requestWithSequence({ method: 'send' })
    request.cancel()
    await expect(request.promise).rejects.toBeDefined()
    expect(connection.requestSignals).toHaveLength(0)
  })

  it('rejects cancelled work even when the transport ignores abort', async () => {
    const connection = fakeConnection()
    let finish!: (value: string) => void
    connection.request = () => new Promise(resolve => { finish = resolve as (value: string) => void })
    const manager = new AccountSessionManager(() => connection)
    const session = await manager.connect(account('a'))
    const request = session.requestWithSequence({ method: 'history' })
    await Promise.resolve()
    request.cancel()
    finish('stale history')
    await expect(request.promise).rejects.toBeDefined()
  })

  it('reports synchronous connector failures and allows a retry', async () => {
    let attempt = 0
    const manager = new AccountSessionManager(() => {
      if (++attempt === 1) throw new Error('socket configuration failed')
      return fakeConnection()
    })
    await expect(manager.connect(account('a'))).rejects.toThrow('socket configuration failed')
    expect(manager.status(accountId('a'))).toBe('error')
    await manager.connect(account('a'))
    expect(manager.status(accountId('a'))).toBe('online')
  })

  it('keeps connections and request sequences independent per account', async () => {
    const connections = new Map<string, FakeConnection>()
    const manager = new AccountSessionManager(async (context) => {
      const connection = fakeConnection()
      connections.set(context.id, connection)
      return connection
    })

    const [a, b] = await Promise.all([manager.connect(account('a')), manager.connect(account('b'))])
    expect(a.accountId).toBe(accountId('a'))
    expect(b.accountId).toBe(accountId('b'))
    expect(connections.get('a')).not.toBe(connections.get('b'))

    const first = a.requestWithSequence({ method: 'history' })
    const second = a.requestWithSequence({ method: 'send', params: { text: 'hello' } })
    const other = b.requestWithSequence({ method: 'history' })
    expect(first.sequence).toBe(1)
    expect(second.sequence).toBe(2)
    expect(other.sequence).toBe(1)
    await Promise.all([first.promise, second.promise, other.promise])
    expect(connections.get('a')?.requestSignals).toHaveLength(2)
    expect(connections.get('b')?.requestSignals).toHaveLength(1)
  })

  it('cancels a request and relays external abort without affecting another account', async () => {
    const connections = new Map<string, FakeConnection>()
    const manager = new AccountSessionManager(async (context) => {
      const connection = fakeConnection()
      connection.request = (_request, signal) =>
        new Promise((_resolve, reject) => {
          if (signal.aborted) {
            reject(signal.reason)
            return
          }
          signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        })
      connections.set(context.id, connection)
      return connection
    })
    const [a, b] = await Promise.all([manager.connect(account('a')), manager.connect(account('b'))])

    const external = new AbortController()
    const cancelled = a.requestWithSequence({ method: 'slow' }, { signal: external.signal })
    const independent = b.requestWithSequence({ method: 'slow' })
    external.abort('view changed')
    await expect(cancelled.promise).rejects.toBe('view changed')
    expect(cancelled.signal.aborted).toBe(true)
    expect(independent.signal.aborted).toBe(false)
    independent.cancel()
    await expect(independent.promise).rejects.toBeDefined()
  })

  it('releases subscriptions, cancels in-flight work, and rejects stale completion on disconnect', async () => {
    const connection = fakeConnection()
    let resolveRequest!: (value: string) => void
    connection.request = (_request, _signal) => new Promise((resolve) => {
      resolveRequest = resolve as (value: string) => void
    })
    const manager = new AccountSessionManager(() => connection)
    const session = await manager.connect(account('a'))
    const events: AccountSessionEvent[] = []
    session.subscribe((event) => events.push(event))
    const request = session.requestWithSequence({ method: 'slow' })
    // Let the manager enter the transport before disconnecting it.
    await Promise.resolve()

    const disconnect = manager.disconnect(accountId('a'))
    resolveRequest('late result')
    await disconnect
    connection.events({ type: 'message', payload: 'late event' })
    await expect(request.promise).rejects.toBeInstanceOf(AccountSessionSupersededError)
    expect(connection.closeCount).toBe(1)
    expect(events).toHaveLength(0)
    expect(manager.status(accountId('a'))).toBe('offline')
    expect(manager.cancelAllRequests(accountId('a'))).toBe(0)
  })

  it('removes the account scope and creates a fresh sequence after reconnect', async () => {
    const manager = new AccountSessionManager(() => fakeConnection())
    const first = await manager.connect(account('a'))
    const request = first.requestWithSequence({ method: 'one' })
    await request.promise
    await manager.remove(accountId('a'))
    expect(manager.status(accountId('a'))).toBe('offline')

    const second = await manager.connect(account('a'))
    const fresh = second.requestWithSequence({ method: 'two' })
    expect(fresh.sequence).toBe(1)
    await fresh.promise
  })

  it('invalidates a remotely closed connection before notifying views and allows reconnect', async () => {
    const first = fakeConnection()
    const second = fakeConnection()
    let attempts = 0
    const manager = new AccountSessionManager(() => ++attempts === 1 ? first : second)
    const session = await manager.connect(account('a'))
    const events: AccountSessionEvent[] = []
    session.subscribe(event => {
      events.push(event)
      expect(session.status).toBe('offline')
      expect(() => session.request({ method: 'send_msg' })).toThrow('not connected')
    })
    const request = session.requestWithSequence({ method: 'send_msg' })
    first.events({ type: 'session.closed', payload: { code: 1006 } })
    await expect(request.promise).rejects.toBeDefined()
    expect(first.requestSignals).toHaveLength(0)
    expect(events).toHaveLength(1)
    expect(events[0]?.type).toBe('session.closed')
    await manager.connect(account('a'))
    expect(attempts).toBe(2)
    expect(session.status).toBe('online')
    first.events({ type: 'onebot.event', payload: 'old socket' })
    expect(events).toHaveLength(1)
    await session.request({ method: 'get_login_info' })
    expect(second.requestSignals).toHaveLength(1)
  })

  it('rejects a connection that already closed between open and subscription', async () => {
    const connection = fakeConnection()
    connection.subscribe = listener => {
      listener({ type: 'session.closed', payload: { code: 1006 } })
      return () => undefined
    }
    const manager = new AccountSessionManager(() => connection)
    await expect(manager.connect(account('a'))).rejects.toBeInstanceOf(AccountSessionSupersededError)
    expect(manager.status(accountId('a'))).toBe('offline')
    expect(connection.closeCount).toBe(1)
  })
})
