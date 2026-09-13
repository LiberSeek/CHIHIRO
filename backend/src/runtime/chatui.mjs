import http from 'node:http'
import https from 'node:https'
import { logError } from './log.mjs'

const PREFIX = '/api/runtime/chatui'

function json(res, obj, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(obj))
}

export function createChatuiProxy({ astrbot }) {
  async function handle(req, res, url) {
    const p = url.pathname
    if (p !== PREFIX && !p.startsWith(`${PREFIX}/`)) return false

    let token
    try {
      await astrbot.ensure()
      token = astrbot.mintDashboardToken()
    } catch (e) {
      logError('chatui', 'ensure', e)
      json(res, { error: 'astrbot_unavailable', message: e.message }, 503)
      return true
    }

    const rest = p.slice(PREFIX.length)
    const dest = `/api/v1/chat${rest}${url.search || ''}`
    const target = new URL(astrbot.url)
    const headers = { ...req.headers }
    delete headers.connection
    delete headers['proxy-connection']
    headers.host = target.host
    headers.authorization = `Bearer ${token}`

    const method = (req.method || 'GET').toUpperCase()
    const opts = {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: dest,
      method,
      headers
    }

    await new Promise((resolve) => {
      const transport = target.protocol === 'https:' ? https : http
      const up = transport.request(opts, (upRes) => {
        const ct = upRes.headers['content-type'] || 'application/json; charset=utf-8'
        const out = {
          'content-type': ct,
          'cache-control': upRes.headers['cache-control'] || 'no-cache'
        }
        res.writeHead(upRes.statusCode || 502, out)
        upRes.pipe(res)
        upRes.on('end', () => resolve())
        upRes.on('error', () => resolve())
      })
      up.on('error', (err) => {
        logError('chatui', 'upstream', err)
        if (!res.headersSent) {
          json(res, { error: 'bad_gateway', message: err.message }, 502)
        } else {
          try { res.end() } catch { /* closed */ }
        }
        resolve()
      })
      const abortUpstream = () => {
        if (!up.destroyed) up.destroy()
        resolve()
      }
      req.once('aborted', abortUpstream)
      res.once('close', abortUpstream)
      if (method === 'GET' || method === 'HEAD') up.end()
      else req.pipe(up)
    })
    return true
  }

  return { handle }
}
