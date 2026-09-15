import { logError } from '../runtime/log.mjs'

function unavailableMessage(error) {
  return error?.message || 'AstrBot 当前不可用'
}

export async function ensureAstrbotReady({ astrbot, res, socket } = {}) {
  try {
    await astrbot.ensure()
    return true
  } catch (error) {
    const message = unavailableMessage(error)
    logError('gw', 'astrbot ensure', message)

    if (res && !res.headersSent) {
      res.writeHead(503, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      })
      res.end(JSON.stringify({
        error: 'astrbot_unavailable',
        message: 'AstrBot 当前不可用，请稍后重试',
        detail: message
      }))
    }

    if (socket && !socket.destroyed) socket.destroy()
    return false
  }
}
