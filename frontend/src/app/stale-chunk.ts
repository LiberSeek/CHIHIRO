export const STALE_CHUNK_KEY = 'chihiro-stale-chunk-reload'

export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk \S+ failed/i.test(message)
}

export function recoverStaleChunk(
  error: unknown,
  hooks: { storage?: Storage | null; reload?: () => void } = {},
): boolean {
  if (!isStaleChunkError(error)) return false
  const storage = hooks.storage ?? (typeof sessionStorage === 'undefined' ? null : sessionStorage)
  const reload = hooks.reload ?? (typeof location === 'undefined' ? undefined : () => location.reload())
  if (!storage || !reload) return false
  try {
    if (storage.getItem(STALE_CHUNK_KEY) === '1') return false
    storage.setItem(STALE_CHUNK_KEY, '1')
  } catch {
    return false
  }
  reload()
  return true
}

export function clearStaleChunkRecovery(storage: Storage | null = typeof sessionStorage === 'undefined' ? null : sessionStorage): void {
  try { storage?.removeItem(STALE_CHUNK_KEY) } catch { /* ignore private-mode storage */ }
}
