import { createRequire } from 'node:module'
import { once } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { accountId } from '../contracts'
import { AccountSessionManager, type AccountSessionEvent } from './account-session-manager'
import { createOneBotAccountConnector, type OneBotResponse } from './onebot-account-connector'

// The fixture uses the existing backend WS dependency; the client is Node's WebSocket API.
const { WebSocketServer } = createRequire(import.meta.url)('ws')
interface FixtureSocket {
  send(data: string): void
  close(code: number): void
  on(name: string, listener: (data: Buffer) => void): void
}
const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup() })

async function fixture() {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  const paths: string[] = []
  const connections = new Map<string, FixtureSocket>()
  server.on('connection', (socket: FixtureSocket, request: { url: string }) => {
    paths.push(request.url)
    const id = decodeURIComponent(request.url.split('/')[2])
    connections.set(id, socket)
    // ws servers expose an EventEmitter, unlike the browser client under test.
    socket.on('message', data => {
      const frame = JSON.parse(data.toString())
      socket.send(JSON.stringify({
        echo: frame.echo, status: 'ok', retcode: 0,
        data: { user_id: Number(id.slice(3)), nickname: id },
      }))
    })
  })
  await once(server, 'listening')
  const manager = new AccountSessionManager(createOneBotAccountConnector({
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    connectTimeoutMs: 2000, requestTimeoutMs: 2000,
  }))
  const context = (id: string) => ({ id: accountId(id), label: id, platform: 'qq' as const, status: 'online' as const })
  cleanups.push(async () => {
    await Promise.all([...connections.keys()].map(id => manager.disconnect(accountId(id))))
    for (const client of server.clients) client.terminate()
    await new Promise<void>(resolve => server.close(() => resolve()))
  })
  return { manager, context, paths, connections }
}

describe('OneBot over an isolated real WebSocket server', () => {
  it('keeps simultaneous account paths, responses and push events isolated', async () => {
    const f = await fixture()
    const [a, b] = await Promise.all([
      f.manager.connect(f.context('qq:10001')), f.manager.connect(f.context('qq:10002')),
    ])
    const [ra, rb] = await Promise.all([
      a.request<OneBotResponse<{ user_id: number }>>({ method: 'get_login_info' }),
      b.request<OneBotResponse<{ user_id: number }>>({ method: 'get_login_info' }),
    ])
    expect(f.paths.sort()).toEqual(['/i/qq%3A10001/onebot-ws', '/i/qq%3A10002/onebot-ws'])
    expect(ra.data.user_id).toBe(10001)
    expect(rb.data.user_id).toBe(10002)
    const events: AccountSessionEvent[] = []
    a.subscribe(event => events.push(event))
    const wire = f.connections.get('qq:10001')!
    wire.send(JSON.stringify({ self_id: 10002, post_type: 'message' }))
    wire.send(JSON.stringify({ self_id: 10001, post_type: 'message', message_id: 7 }))
    await vi.waitFor(() => expect(events).toHaveLength(2))
    expect(events[0].type).toBe('session.error')
    expect(events[1]).toMatchObject({ type: 'onebot.event', accountId: 'qq:10001', payload: { message_id: 7 } })
  })

  it('retires a network-closed connection and creates a new one on explicit retry', async () => {
    const f = await fixture()
    const a = await f.manager.connect(f.context('qq:10001'))
    f.connections.get('qq:10001')!.close(1000)
    await vi.waitFor(() => expect(a.status).toBe('offline'))
    await f.manager.connect(f.context('qq:10001'))
    const response = await a.request<OneBotResponse<{ user_id: number }>>({ method: 'get_login_info' })
    expect(response.data.user_id).toBe(10001)
    expect(f.paths).toHaveLength(2)
  })
})
