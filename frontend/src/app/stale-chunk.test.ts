import { describe, expect, it, vi } from 'vitest'

import { clearStaleChunkRecovery, isStaleChunkError, recoverStaleChunk, STALE_CHUNK_KEY } from './stale-chunk'

function memoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() { return store.size },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => { store.delete(key) },
    setItem: (key: string, value: string) => { store.set(key, String(value)) },
  }
}

describe('stale chunk recovery', () => {
  it('detects a missing hashed runtime module', () => {
    expect(isStaleChunkError(new Error(
      'Failed to fetch dynamically imported module: http://127.0.0.1:3100/assets/runtime-TdDcbKqw.js',
    ))).toBe(true)
    expect(isStaleChunkError(new Error('Agent 连接失败'))).toBe(false)
  })

  it('reloads once for a stale chunk then stops', () => {
    const reload = vi.fn()
    const storage = memoryStorage()
    const error = new Error('Failed to fetch dynamically imported module: http://127.0.0.1:3100/assets/runtime-TdDcbKqw.js')
    expect(recoverStaleChunk(error, { storage, reload })).toBe(true)
    expect(reload).toHaveBeenCalledOnce()
    expect(storage.getItem(STALE_CHUNK_KEY)).toBe('1')
    expect(recoverStaleChunk(error, { storage, reload })).toBe(false)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('clears the reload guard after a successful load', () => {
    const storage = memoryStorage()
    storage.setItem(STALE_CHUNK_KEY, '1')
    clearStaleChunkRecovery(storage)
    expect(storage.getItem(STALE_CHUNK_KEY)).toBeNull()
  })
})
