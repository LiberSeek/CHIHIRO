import { describe, expect, it, vi } from 'vitest'

import { accountId, type AccountContext } from '../contracts'

import {
  createOneBotAccountConnector,
  OneBotProtocolError,
  OneBotRequestError,
  type OneBotWebSocket,
} from './onebot-account-connector'

type SocketListener = (event: never) => void

class FakeSocket implements OneBotWebSocket {
  readyState = 0
  sent: string[] = []
  closeCalls: Array<[number | undefined, string | undefined]> = []
  private listeners = new Map<string, Set<SocketListener>>()

  addEventListener(type: string, listener: SocketListener): void {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: SocketListener): void {
    this.listeners.get(type)?.delete(listener)
  }

  send(data: string): void {
    if (this.readyState !== 1) throw new Error('not open')
    this.sent.push(data)
  }

  close(code?: number, reason?: string): void {
    this.closeCalls.push([code, reason])
    this.readyState = 3
  }

  open(): void {
    this.readyState = 1
    this.emit('open', new Event('open'))
  }

  message(value: unknown, raw = false): void {
    const data = raw ? value : JSON.stringify(value)
    this.emit('message', { data } as MessageEvent)
  }

  error(): void {
    this.emit('error', new Event('error'))
  }

  closed(code = 1006, reason = 'gone', wasClean = false): void {
    this.readyState = 3
    this.emit('close', { code, reason, wasClean } as CloseEvent)
  }

  private emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event as never)
  }
}

const context: AccountContext = {
  id: accountId('qq:12345'),
  label: 'test',
  platform: 'qq',
  status: 'online',
}

function setup(timeout = 1000) {
  const socket = new FakeSocket()
  const urls: string[] = []
  const connector = createOneBotAccountConnector({
    baseUrl: 'https://chihiro.test/workbench?token=never-copy',
    requestTimeoutMs: timeout,
    socketFactory: (url) => {
      urls.push(url)
      return socket
    },
  })
  const connectAbort = new AbortController()
  const connecting = connector(context, connectAbort.signal)
  return { socket, urls, connecting, connectAbort }
}

async function connected(timeout?: number) {
  const state = setup(timeout)
  state.socket.open()
  return { ...state, connection: await state.connecting }
}

describe('OneBot account connector', () => {
  it('opens only the account-scoped same-origin gateway URL', async () => {
    const { urls, connection } = await connected()
    expect(urls).toEqual(['wss://chihiro.test/i/qq%3A12345/onebot-ws'])
    await connection.close()
  })

  it('correlates concurrent requests and returns complete OneBot envelopes', async () => {
    const { socket, connection } = await connected()
    const first = connection.request({ method: 'get_msg', params: { message_id: 1 } }, new AbortController().signal)
    const second = connection.request({ method: 'send_msg', params: { message: 'hi' } }, new AbortController().signal)
    const [firstFrame, secondFrame] = socket.sent.map((value) => JSON.parse(value))
    expect(firstFrame.echo).not.toBe(secondFrame.echo)
    expect(firstFrame).toMatchObject({ action: 'get_msg', params: { message_id: 1 } })

    socket.message({ status: 'ok', retcode: 0, data: { message_id: 2 }, echo: secondFrame.echo })
    socket.message({ status: 'ok', retcode: 0, data: { message: [] }, echo: firstFrame.echo })
    await expect(second).resolves.toEqual({ status: 'ok', retcode: 0, data: { message_id: 2 }, echo: secondFrame.echo })
    await expect(first).resolves.toEqual({ status: 'ok', retcode: 0, data: { message: [] }, echo: firstFrame.echo })
  })

  it('retains failed response details on OneBot errors', async () => {
    const { socket, connection } = await connected()
    const request = connection.request({ method: 'send_msg' }, new AbortController().signal)
    const { echo } = JSON.parse(socket.sent[0])
    const response = { status: 'failed', retcode: 1404, data: null, wording: 'unknown action', echo }
    socket.message(response)
    await expect(request).rejects.toMatchObject({ name: 'OneBotRequestError', response })
    await expect(request).rejects.toBeInstanceOf(OneBotRequestError)
  })

  it('rejects a correlated malformed response without waiting for timeout', async () => {
    const { socket, connection } = await connected()
    const request = connection.request({ method: 'get_msg' }, new AbortController().signal)
    const { echo } = JSON.parse(socket.sent[0])
    socket.message({ status: 'ok', data: {}, echo })
    await expect(request).rejects.toBeInstanceOf(OneBotProtocolError)
  })

  it('rejects a mismatched get_login_info identity', async () => {
    const { socket, connection } = await connected()
    const request = connection.request({ method: 'get_login_info' }, new AbortController().signal)
    const { echo } = JSON.parse(socket.sent[0])
    socket.message({ status: 'ok', retcode: 0, data: { user_id: 999 }, echo })
    await expect(request).rejects.toBeInstanceOf(OneBotProtocolError)
  })

  it('emits valid account events and reports malformed or mismatched frames', async () => {
    const { socket, connection } = await connected()
    const events: Array<{ type: string; payload?: unknown }> = []
    connection.subscribe((event) => events.push(event))
    socket.message('{', true)
    socket.message({ post_type: 'message', self_id: 999, message: 'wrong account' })
    socket.message({ post_type: 'message', self_id: 12345, message: 'hello' })

    expect(events.filter((event) => event.type === 'session.error')).toHaveLength(2)
    expect(events.at(-1)).toEqual({
      type: 'message',
      payload: { post_type: 'message', self_id: 12345, message: 'hello' },
    })
  })

  it('does not dispatch an already-aborted request', async () => {
    const { socket, connection } = await connected()
    const abort = new AbortController()
    abort.abort('cancelled')
    await expect(connection.request({ method: 'send_msg' }, abort.signal)).rejects.toThrow('cancelled')
    expect(socket.sent).toHaveLength(0)
  })

  it('cancels only the wait after dispatch and discards its late reply', async () => {
    const { socket, connection } = await connected()
    const abort = new AbortController()
    const request = connection.request({ method: 'send_msg' }, abort.signal)
    const { echo } = JSON.parse(socket.sent[0])
    abort.abort('view changed')
    await expect(request).rejects.toThrow('view changed')
    socket.message({ status: 'ok', retcode: 0, data: { message_id: 4 }, echo })
    expect(socket.sent).toHaveLength(1)
  })

  it('times out requests and ignores replies that arrive afterward', async () => {
    vi.useFakeTimers()
    try {
      const { socket, connection } = await connected(20)
      const request = connection.request({ method: 'get_msg' }, new AbortController().signal)
      const rejected = expect(request).rejects.toThrow('timed out')
      const { echo } = JSON.parse(socket.sent[0])
      await vi.advanceTimersByTimeAsync(20)
      await rejected
      socket.message({ status: 'ok', retcode: 0, data: {}, echo })
    } finally {
      vi.useRealTimers()
    }
  })

  it('settles connect and pending requests on abort, error, and close', async () => {
    const beforeOpen = setup()
    beforeOpen.connectAbort.abort('superseded')
    await expect(beforeOpen.connecting).rejects.toThrow('superseded')
    expect(beforeOpen.socket.closeCalls).toEqual([[1000, 'aborted']])

    const errored = setup()
    errored.socket.error()
    await expect(errored.connecting).rejects.toThrow('failed')

    const { socket, connection } = await connected()
    const events: string[] = []
    connection.subscribe((event) => events.push(event.type))
    const pending = connection.request({ method: 'get_msg' }, new AbortController().signal)
    socket.closed(1006, 'lost')
    socket.closed(1006, 'duplicate')
    await expect(pending).rejects.toThrow('closed')
    expect(events).toEqual(['session.closed'])
    await expect(connection.request({ method: 'send_msg' }, new AbortController().signal)).rejects.toThrow('not open')
  })
})
