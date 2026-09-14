export interface RuntimeStateStreamOptions {
  createEventSource?: (url: string) => EventSource
  setTimer?: (callback: () => void, delay: number) => number
  clearTimer?: (id: number) => void
  fallbackDelayMs?: number
}

export interface RuntimeStateStream {
  close(): void
}

export function startRuntimeStateStream(
  applyState: (value: unknown) => void,
  fallbackRefresh: () => void | Promise<void>,
  options: RuntimeStateStreamOptions = {},
): RuntimeStateStream {
  const createEventSource = options.createEventSource ?? ((url: string) => new EventSource(url))
  const setTimer = options.setTimer ?? ((callback, delay) => window.setInterval(callback, delay))
  const clearTimer = options.clearTimer ?? ((id) => window.clearInterval(id))
  const fallbackDelayMs = options.fallbackDelayMs ?? 10_000
  let closed = false
  let source: EventSource | undefined
  let fallbackTimer: number | undefined

  const startFallback = () => {
    if (closed || fallbackTimer !== undefined) return
    void fallbackRefresh()
    fallbackTimer = setTimer(() => { void fallbackRefresh() }, fallbackDelayMs)
  }

  try {
    source = createEventSource('/api/runtime/stream')
    source.onmessage = (event) => {
      if (closed) return
      try {
        applyState(JSON.parse(event.data))
      } catch {
        // Ignore malformed frames and wait for the next runtime snapshot.
      }
    }
    source.onerror = () => {
      source?.close()
      source = undefined
      startFallback()
    }
  } catch {
    startFallback()
  }

  return {
    close() {
      closed = true
      source?.close()
      source = undefined
      if (fallbackTimer !== undefined) {
        clearTimer(fallbackTimer)
        fallbackTimer = undefined
      }
    },
  }
}
