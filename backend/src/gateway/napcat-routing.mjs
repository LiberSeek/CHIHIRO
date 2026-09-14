export function resolveNapcatProxy(qq, instanceId, fallback, { preferReady = false } = {}) {
  // A supplied account selector must never resolve to another account.
  if (instanceId) return qq.getInstanceProxy(instanceId) || null
  if (preferReady) {
    const ready = qq.getReadyProxy?.()
    if (ready) return ready
  }
  return fallback()
}

export function resolveOnebotWsTarget(napcat, instanceId, fallbackUrl) {
  if (!napcat) return null
  const port = Number(napcat.wsPort)
  if (Number.isInteger(port) && port > 0 && port <= 65535) return `http://127.0.0.1:${port}`
  return instanceId ? null : fallbackUrl.replace(/^ws/, 'http')
}
