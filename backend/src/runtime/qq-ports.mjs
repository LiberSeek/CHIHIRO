import net from 'node:net'

export function portOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const s = net.connect({ port, host })
    s.setTimeout(400)
    s.on('connect', () => {
      s.destroy()
      resolve(true)
    })
    s.on('error', () => resolve(false))
    s.on('timeout', () => {
      s.destroy()
      resolve(false)
    })
  })
}

export function portsForSlot(slot) {
  const webui = 6099 + slot * 100
  const http = 5800 + slot * 20
  const ws = http + 1
  const astrbotReverse = 13000 + slot
  return { webui, http, ws, astrbotReverse }
}

export function astrbotReversePort(ports) {
  if (ports?.astrbotReverse) return Number(ports.astrbotReverse)
  const webui = Number(ports?.webui)
  if (Number.isFinite(webui) && webui >= 6099) {
    const slot = Math.round((webui - 6099) / 100)
    if (slot >= 0) return 13000 + slot
  }
  return 13000
}

export async function allocateIsolatedPorts(reserved = []) {
  const taken = new Set(reserved.flatMap((p) => [p.webui, p.http, p.ws, p.astrbotReverse].filter(Boolean)))
  for (let slot = 0; slot <= 40; slot++) {
    const ports = portsForSlot(slot)
    if ([ports.webui, ports.http, ports.ws, ports.astrbotReverse].some((n) => taken.has(n))) continue
    if (await portOpen(ports.webui) || await portOpen(ports.http) || await portOpen(ports.ws) || await portOpen(ports.astrbotReverse)) continue
    return { slot, ...ports }
  }
  throw new Error('没有可用的 OneBot/WebUI 端口')
}
