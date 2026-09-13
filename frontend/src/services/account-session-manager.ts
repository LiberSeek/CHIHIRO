import type { AccountContext, AccountId } from '../contracts'

/** A transport-agnostic request sent through an account connection. */
export interface AccountSessionRequest {
  method: string
  params?: unknown
}

/** Events emitted by the transport. The manager adds the owning account id. */
export interface AccountSessionEvent {
  type: string
  payload?: unknown
}

export interface AccountScopedEvent extends AccountSessionEvent {
  accountId: AccountId
}

export type Unsubscribe = () => void

/**
 * The only protocol surface the unified frontend needs from an account
 * transport. A WebSocket, an HTTP bridge, or a test double can implement it.
 */
export interface AccountSessionConnection {
  request<T>(request: AccountSessionRequest, signal: AbortSignal): Promise<T>
  subscribe(listener: (event: AccountSessionEvent) => void): Unsubscribe
  close(): void | Promise<void>
}

export type AccountSessionConnector = (
  context: AccountContext,
  signal: AbortSignal,
) => AccountSessionConnection | Promise<AccountSessionConnection>

export interface RequestOptions {
  signal?: AbortSignal
}

export interface RequestHandle<T> {
  /** Monotonically increasing within one account session. */
  readonly sequence: number
  readonly signal: AbortSignal
  readonly promise: Promise<T>
  cancel(): void
}

export type AccountSessionStatus = 'offline' | 'connecting' | 'online' | 'error'

export class AccountSessionSupersededError extends Error {
  constructor(accountId: AccountId) {
    super(`Account session was replaced or disconnected: ${accountId}`)
    this.name = 'AccountSessionSupersededError'
  }
}

interface PendingRequest {
  controller: AbortController
  externalSignal?: AbortSignal
  removeExternalListener?: () => void
}

interface SessionRecord {
  context: AccountContext
  status: AccountSessionStatus
  generation: number
  sequence: number
  connection?: AccountSessionConnection
  connectAbort?: AbortController
  connectPromise?: Promise<AccountSession>
  requests: Map<number, PendingRequest>
  subscriptions: Set<Unsubscribe>
}

function abortWithReason(controller: AbortController | undefined, reason?: unknown): void {
  if (!controller || controller.signal.aborted) return
  // AbortController.abort(reason) is available in modern browsers, but the
  // fallback keeps this service usable in older WebViews and test runtimes.
  try {
    controller.abort(reason)
  } catch {
    controller.abort()
  }
}

/**
 * A handle for one account. It intentionally has no reference to the active
 * account in the UI; callers must obtain the handle for the account they mean.
 */
export class AccountSession {
  constructor(
    private readonly manager: AccountSessionManager,
    readonly accountId: AccountId,
  ) {}

  get status(): AccountSessionStatus {
    return this.manager.status(this.accountId)
  }

  request<T>(request: AccountSessionRequest, options?: RequestOptions): Promise<T> {
    return this.requestWithSequence<T>(request, options).promise
  }

  requestWithSequence<T>(
    request: AccountSessionRequest,
    options?: RequestOptions,
  ): RequestHandle<T> {
    return this.manager.requestWithSequence<T>(this.accountId, request, options)
  }

  subscribe(listener: (event: AccountScopedEvent) => void): Unsubscribe {
    return this.manager.subscribe(this.accountId, listener)
  }

  cancelRequest(sequence: number): boolean {
    return this.manager.cancelRequest(this.accountId, sequence)
  }

  cancelAllRequests(): number {
    return this.manager.cancelAllRequests(this.accountId)
  }
}

/**
 * Owns one transport and one cancellation/subscription scope per account.
 * The manager never consults a global "current account", so switching views
 * cannot redirect an in-flight request to another account.
 */
export class AccountSessionManager {
  private readonly records = new Map<AccountId, SessionRecord>()
  private readonly handles = new Map<AccountId, AccountSession>()

  constructor(private readonly connector: AccountSessionConnector) {}

  /** Connect (or return the existing connection) for this exact account. */
  connect(context: AccountContext): Promise<AccountSession> {
    const record = this.ensureRecord(context)
    if (record.connection && record.status === 'online') {
      return Promise.resolve(this.handleFor(context.id))
    }
    if (record.connectPromise) return record.connectPromise

    const generation = ++record.generation
    const abort = new AbortController()
    record.connectAbort = abort
    record.status = 'connecting'

    const pending = Promise.resolve()
      .then(() => {
        if (abort.signal.aborted) throw new AccountSessionSupersededError(context.id)
        return this.connector(context, abort.signal)
      })
      .then(async (connection) => {
        // A disconnect/remove may have happened while the connector awaited.
        if (record.generation !== generation || abort.signal.aborted) {
          await connection.close()
          throw new AccountSessionSupersededError(context.id)
        }
        record.connection = connection
        record.status = 'online'
        return this.handleFor(context.id)
      })
      .catch((error: unknown) => {
        if (record.generation === generation) {
          record.connection = undefined
          record.status = abort.signal.aborted ? 'offline' : 'error'
        }
        throw error
      })
      .finally(() => {
        if (record.generation === generation) {
          record.connectAbort = undefined
          record.connectPromise = undefined
        }
      })

    record.connectPromise = pending
    return pending
  }

  /** Return a stable account handle without making a connection. */
  session(accountId: AccountId): AccountSession {
    return this.handleFor(accountId)
  }

  status(accountId: AccountId): AccountSessionStatus {
    return this.records.get(accountId)?.status ?? 'offline'
  }

  requestWithSequence<T>(
    accountId: AccountId,
    request: AccountSessionRequest,
    options?: RequestOptions,
  ): RequestHandle<T> {
    const record = this.records.get(accountId)
    if (!record?.connection || record.status !== 'online') {
      throw new Error(`Account is not connected: ${accountId}`)
    }

    const sequence = ++record.sequence
    const generation = record.generation
    const connection = record.connection
    const controller = new AbortController()
    const externalSignal = options?.signal
    let removeExternalListener: (() => void) | undefined

    if (externalSignal) {
      const relay = () => abortWithReason(controller, externalSignal.reason)
      if (externalSignal.aborted) relay()
      else {
        externalSignal.addEventListener('abort', relay, { once: true })
        removeExternalListener = () => externalSignal.removeEventListener('abort', relay)
      }
    }

    const pending: PendingRequest = { controller, externalSignal, removeExternalListener }
    record.requests.set(sequence, pending)
    const promise = Promise.resolve()
      .then(() => {
        // Cancellation before dispatch must never invoke a send transport.
        controller.signal.throwIfAborted()
        if (record.generation !== generation || record.connection !== connection) {
          throw new AccountSessionSupersededError(accountId)
        }
        return connection.request<T>(request, controller.signal)
      })
      .then((value) => {
        if (record.generation !== generation || record.connection !== connection) {
          throw new AccountSessionSupersededError(accountId)
        }
        controller.signal.throwIfAborted()
        return value
      })
      .finally(() => {
        pending.removeExternalListener?.()
        record.requests.delete(sequence)
      })

    return {
      sequence,
      signal: controller.signal,
      promise,
      cancel: () => abortWithReason(controller),
    }
  }

  cancelRequest(accountId: AccountId, sequence: number): boolean {
    const request = this.records.get(accountId)?.requests.get(sequence)
    if (!request) return false
    abortWithReason(request.controller)
    return true
  }

  cancelAllRequests(accountId: AccountId): number {
    const requests = this.records.get(accountId)?.requests
    if (!requests) return 0
    let cancelled = 0
    for (const request of requests.values()) {
      if (!request.controller.signal.aborted) {
        abortWithReason(request.controller)
        cancelled += 1
      }
    }
    return cancelled
  }

  subscribe(accountId: AccountId, listener: (event: AccountScopedEvent) => void): Unsubscribe {
    const record = this.records.get(accountId)
    if (!record?.connection || record.status !== 'online') {
      throw new Error(`Account is not connected: ${accountId}`)
    }
    let active = true
    const unsubscribeTransport = record.connection.subscribe((event) => {
      if (active && record.connection) listener({ ...event, accountId })
    })
    const unsubscribe = () => {
      if (!active) return
      active = false
      record.subscriptions.delete(unsubscribe)
      unsubscribeTransport()
    }
    record.subscriptions.add(unsubscribe)
    return unsubscribe
  }

  /** Disconnect while retaining a reusable offline account handle. */
  async disconnect(accountId: AccountId): Promise<void> {
    const record = this.records.get(accountId)
    if (!record) return
    ++record.generation
    abortWithReason(record.connectAbort)
    record.connectAbort = undefined
    record.connectPromise = undefined
    this.cancelAllRequests(accountId)
    for (const unsubscribe of [...record.subscriptions]) unsubscribe()
    record.subscriptions.clear()
    const connection = record.connection
    record.connection = undefined
    record.status = 'offline'
    if (connection) await connection.close()
  }

  /** Remove an account and all resources owned by it. */
  async remove(accountId: AccountId): Promise<void> {
    await this.disconnect(accountId)
    this.records.delete(accountId)
    this.handles.delete(accountId)
  }

  private ensureRecord(context: AccountContext): SessionRecord {
    const existing = this.records.get(context.id)
    if (existing) {
      existing.context = context
      return existing
    }
    const created: SessionRecord = {
      context,
      status: 'offline',
      generation: 0,
      sequence: 0,
      requests: new Map(),
      subscriptions: new Set(),
    }
    this.records.set(context.id, created)
    return created
  }

  private handleFor(accountId: AccountId): AccountSession {
    const existing = this.handles.get(accountId)
    if (existing) return existing
    const handle = new AccountSession(this, accountId)
    this.handles.set(accountId, handle)
    return handle
  }
}
