import { describe, expect, it, vi } from 'vitest'
import { startRuntimeStateStream } from './runtime-state-stream'

class FakeEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  close = vi.fn()
}

describe('runtime state stream', () => {
  it('applies snapshots from SSE without starting fallback polling', () => {
    const source = new FakeEventSource()
    const apply = vi.fn()
    const refresh = vi.fn()
    const setTimer = vi.fn(() => 1)

    const stream = startRuntimeStateStream(apply, refresh, {
      createEventSource: () => source as unknown as EventSource,
      setTimer,
    })

    source.onmessage?.({ data: JSON.stringify({ accounts: { accounts: [] } }) } as MessageEvent)
    expect(apply).toHaveBeenCalledWith({ accounts: { accounts: [] } })
    expect(refresh).not.toHaveBeenCalled()
    expect(setTimer).not.toHaveBeenCalled()
    stream.close()
    expect(source.close).toHaveBeenCalledOnce()
  })

  it('falls back to low-frequency refresh when SSE fails', () => {
    const source = new FakeEventSource()
    const apply = vi.fn()
    const refresh = vi.fn()
    const clearTimer = vi.fn()
    const stream = startRuntimeStateStream(apply, refresh, {
      createEventSource: () => source as unknown as EventSource,
      setTimer: vi.fn(() => 7),
      clearTimer,
      fallbackDelayMs: 12_000,
    })

    source.onerror?.(new Event('error'))

    expect(source.close).toHaveBeenCalledOnce()
    expect(refresh).toHaveBeenCalledOnce()
    stream.close()
    expect(clearTimer).toHaveBeenCalledWith(7)
  })

  it('ignores malformed frames and stops applying after close', () => {
    const source = new FakeEventSource()
    const apply = vi.fn()
    const stream = startRuntimeStateStream(apply, vi.fn(), {
      createEventSource: () => source as unknown as EventSource,
    })

    source.onmessage?.({ data: '{' } as MessageEvent)
    stream.close()
    source.onmessage?.({ data: JSON.stringify({ late: true }) } as MessageEvent)

    expect(apply).not.toHaveBeenCalled()
  })
})
