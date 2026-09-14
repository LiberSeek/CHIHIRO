import {
  AccountSessionSupersededError,
  type AccountSession,
  type AccountSessionEvent,
  type RequestHandle,
  type Unsubscribe,
} from '../../../services/account-session-manager'
import { OneBotRequestError, type OneBotResponse } from '../../../services/onebot-account-connector'

export interface NativeAccountHandlers {
  dispatch(payload: unknown, echo?: string): void
  error(error: unknown): void
  closed(): void
}

/** Owns only a native view's work; the session manager owns its socket. */
export class NativeAccountBinding {
  readonly accountId
  private active = true
  private readonly requests = new Set<RequestHandle<OneBotResponse>>()
  private unsubscribe: Unsubscribe = () => undefined

  constructor(private readonly session: AccountSession, private readonly handlers: NativeAccountHandlers) {
    this.accountId = session.accountId
    this.unsubscribe = session.subscribe(event => this.event(event))
  }

  get valid(): boolean { return this.active }

  invalidate(): void {
    if (!this.active) return
    this.active = false
    this.unsubscribe()
    for (const request of this.requests) request.cancel()
    this.requests.clear()
  }

  async request(method: string, params: unknown): Promise<OneBotResponse> {
    if (!this.active) throw new AccountSessionSupersededError(this.accountId)
    const handle = this.session.requestWithSequence<OneBotResponse>({ method, params })
    this.requests.add(handle)
    try {
      const result = await handle.promise
      if (!this.active) throw new AccountSessionSupersededError(this.accountId)
      return result
    } catch (error) {
      if (!this.active) throw new AccountSessionSupersededError(this.accountId)
      throw error
    } finally {
      this.requests.delete(handle)
    }
  }

  send(method: string, params: unknown, echo: string): void {
    void this.request(method, params).then(response => {
      if (this.active) this.handlers.dispatch(response, echo)
    }).catch(error => {
      if (!this.active) return
      if (error instanceof OneBotRequestError) this.handlers.dispatch(error.response, echo)
      else this.handlers.error(error)
    })
  }

  private event(event: AccountSessionEvent): void {
    if (!this.active) return
    if (event.type === 'session.closed') {
      this.invalidate()
      this.handlers.closed()
    } else if (event.type === 'session.error') {
      this.handlers.error(event.payload)
    } else if (event.type === 'onebot.event') {
      const payload = event.payload
      if (!payload || typeof payload !== 'object' || !('self_id' in payload)
        || `qq:${String(payload.self_id)}` !== this.accountId) return
      this.handlers.dispatch(payload)
    }
  }
}
