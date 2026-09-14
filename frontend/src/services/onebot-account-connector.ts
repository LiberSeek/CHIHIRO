import type { AccountContext } from '../contracts'

import type {
  AccountSessionConnection,
  AccountSessionConnector,
  AccountSessionEvent,
  AccountSessionRequest,
  Unsubscribe,
} from './account-session-manager'

interface SocketEventMap {
  open: Event
  message: MessageEvent<unknown>
  error: Event
  close: CloseEvent
}

export interface OneBotWebSocket {
  readonly readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
  addEventListener<K extends keyof SocketEventMap>(
    type: K,
    listener: (event: SocketEventMap[K]) => void,
  ): void
  removeEventListener<K extends keyof SocketEventMap>(
    type: K,
    listener: (event: SocketEventMap[K]) => void,
  ): void
}

export type OneBotSocketFactory = (url: string) => OneBotWebSocket

export interface OneBotAccountConnectorOptions {
  socketFactory?: OneBotSocketFactory
  /** Used by tests and non-browser hosts. Browser callers always default to the current origin. */
  baseUrl?: string
  requestTimeoutMs?: number
}

export interface OneBotResponse<T = unknown> {
  status: 'ok' | 'failed'
  retcode: number
  data: T
  echo: string
  message?: string
  wording?: string
}

export class OneBotRequestError extends Error {
  constructor(readonly response: OneBotResponse) {
    super(response.wording || response.message || `OneBot request failed (${response.retcode})`)
    this.name = 'OneBotRequestError'
  }
}

export class OneBotProtocolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OneBotProtocolError'
  }
}

const CONNECTING = 0
const OPEN = 1
const CLOSED = 3

function asError(reason: unknown, fallback: string): Error {
  return reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : fallback)
}

function expectedUin(context: AccountContext): string {
  const match = /^qq:(\d+)$/.exec(context.id)
  if (!match) throw new Error(`Invalid QQ account id: ${context.id}`)
  return match[1]
}

function socketUrl(context: AccountContext, baseUrl?: string): string {
  const source = baseUrl ?? globalThis.location?.href
  if (!source) throw new Error('Cannot create an account WebSocket without a browser origin')
  const url = new URL(`/i/${encodeURIComponent(context.id)}/onebot-ws`, source)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.username = ''
  url.password = ''
  url.search = ''
  url.hash = ''
  return url.href
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isResponse(value: Record<string, unknown>): value is Record<string, unknown> & OneBotResponse {
  return typeof value.echo === 'string'
    && (value.status === 'ok' || value.status === 'failed')
    && typeof value.retcode === 'number'
    && 'data' in value
}

function defaultSocketFactory(url: string): OneBotWebSocket {
  return new WebSocket(url)
}

interface PendingRequest {
  resolve: (response: OneBotResponse) => void
  reject: (error: unknown) => void
  timer: ReturnType<typeof setTimeout>
  removeAbort: () => void
}

export function createOneBotAccountConnector(
  options: OneBotAccountConnectorOptions = {},
): AccountSessionConnector {
  const socketFactory = options.socketFactory ?? defaultSocketFactory
  const requestTimeoutMs = options.requestTimeoutMs ?? 50_000

  return (context, connectSignal) => new Promise<AccountSessionConnection>((resolve, reject) => {
    if (connectSignal.aborted) {
      reject(asError(connectSignal.reason, 'Account connection aborted'))
      return
    }

    const uin = expectedUin(context)
    const socket = socketFactory(socketUrl(context, options.baseUrl))
    const listeners = new Set<(event: AccountSessionEvent) => void>()
    const pending = new Map<string, PendingRequest>()
    let nextEcho = 0
    let settled = false
    let terminal = false
    let closedEmitted = false

    const emit = (event: AccountSessionEvent) => {
      for (const listener of [...listeners]) listener(event)
    }
    const rejectPending = (error: Error) => {
      for (const [echo, request] of pending) {
        pending.delete(echo)
        clearTimeout(request.timer)
        request.removeAbort()
        request.reject(error)
      }
    }
    const removeConnectAbort = () => connectSignal.removeEventListener('abort', onConnectAbort)
    const failConnect = (error: Error) => {
      if (settled) return
      settled = true
      removeConnectAbort()
      reject(error)
    }
    const terminate = (error: Error) => {
      if (terminal) return
      terminal = true
      rejectPending(error)
      failConnect(error)
    }
    const protocolError = (message: string) => emit({
      type: 'session.error',
      payload: new OneBotProtocolError(message),
    })

    const onOpen = () => {
      if (settled || connectSignal.aborted) return
      settled = true
      removeConnectAbort()
      resolve(connection)
    }
    const onMessage = (event: MessageEvent<unknown>) => {
      if (terminal || typeof event.data !== 'string') {
        if (!terminal) protocolError('OneBot frame must be a JSON string')
        return
      }
      let value: unknown
      try {
        value = JSON.parse(event.data)
      } catch {
        protocolError('OneBot frame contains invalid JSON')
        return
      }
      if (!isRecord(value)) {
        protocolError('OneBot frame must contain an object')
        return
      }

      if ('echo' in value) {
        if (!isResponse(value)) {
          const error = new OneBotProtocolError('OneBot response has an invalid envelope')
          if (typeof value.echo === 'string') {
            const request = pending.get(value.echo)
            if (request) {
              pending.delete(value.echo)
              clearTimeout(request.timer)
              request.removeAbort()
              request.reject(error)
            }
          }
          emit({ type: 'session.error', payload: error })
          return
        }
        const request = pending.get(value.echo)
        if (!request) return
        pending.delete(value.echo)
        clearTimeout(request.timer)
        request.removeAbort()

        if (value.status !== 'ok' || value.retcode !== 0) {
          request.reject(new OneBotRequestError(value))
          return
        }
        if (value.echo.startsWith('get_login_info:')) {
          const responseUin = isRecord(value.data) ? value.data.user_id : undefined
          if (String(responseUin) !== uin) {
            request.reject(new OneBotProtocolError(`OneBot account mismatch: expected ${uin}`))
            return
          }
        }
        request.resolve(value)
        return
      }

      if (typeof value.post_type !== 'string' || !('self_id' in value)) {
        protocolError('OneBot event has an invalid envelope')
        return
      }
      if (String(value.self_id) !== uin) {
        protocolError(`OneBot event account mismatch: expected ${uin}`)
        return
      }
      emit({ type: value.post_type, payload: value })
    }
    const onError = () => {
      const error = new Error(`OneBot WebSocket failed for ${context.id}`)
      emit({ type: 'session.error', payload: error })
      terminate(error)
    }
    const onClose = (event: CloseEvent) => {
      const error = new Error(`OneBot WebSocket closed for ${context.id} (${event.code})`)
      terminate(error)
      if (!closedEmitted) {
        closedEmitted = true
        emit({
          type: 'session.closed',
          payload: { code: event.code, reason: event.reason, wasClean: event.wasClean },
        })
      }
    }
    function onConnectAbort(): void {
      const error = asError(connectSignal.reason, 'Account connection aborted')
      terminate(error)
      if (socket.readyState === CONNECTING || socket.readyState === OPEN) socket.close(1000, 'aborted')
    }

    const connection: AccountSessionConnection = {
      request: <T>(request: AccountSessionRequest, signal: AbortSignal) => {
        if (signal.aborted) return Promise.reject(asError(signal.reason, 'OneBot request aborted'))
        if (terminal || socket.readyState !== OPEN) {
          return Promise.reject(new Error(`OneBot WebSocket is not open for ${context.id}`))
        }

        const echo = `${request.method}:${++nextEcho}`
        return new Promise<T>((requestResolve, requestReject) => {
          const onAbort = () => {
            const active = pending.get(echo)
            if (!active) return
            pending.delete(echo)
            clearTimeout(active.timer)
            signal.removeEventListener('abort', onAbort)
            requestReject(asError(signal.reason, 'OneBot request aborted'))
          }
          const timer = setTimeout(() => {
            const active = pending.get(echo)
            if (!active) return
            pending.delete(echo)
            signal.removeEventListener('abort', onAbort)
            requestReject(new Error(`OneBot request timed out: ${request.method}`))
          }, requestTimeoutMs)
          pending.set(echo, {
            resolve: requestResolve as (response: OneBotResponse) => void,
            reject: requestReject,
            timer,
            removeAbort: () => signal.removeEventListener('abort', onAbort),
          })
          signal.addEventListener('abort', onAbort, { once: true })
          try {
            socket.send(JSON.stringify({ action: request.method, params: request.params ?? {}, echo }))
          } catch (error) {
            const active = pending.get(echo)
            if (active) {
              pending.delete(echo)
              clearTimeout(active.timer)
              active.removeAbort()
            }
            requestReject(error)
          }
        })
      },
      subscribe: (listener): Unsubscribe => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      close: () => {
        const error = new Error(`OneBot WebSocket closed by client for ${context.id}`)
        terminate(error)
        listeners.clear()
        if (socket.readyState !== CLOSED) socket.close(1000, 'client closed')
      },
    }

    socket.addEventListener('open', onOpen)
    socket.addEventListener('message', onMessage)
    socket.addEventListener('error', onError)
    socket.addEventListener('close', onClose)
    connectSignal.addEventListener('abort', onConnectAbort, { once: true })
  })
}

export const oneBotAccountConnector = createOneBotAccountConnector()
