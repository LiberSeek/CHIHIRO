import fs from 'node:fs'
import path from 'node:path'
import { CLIENTS, getClient } from './clients.mjs'
import { createAccountStore } from './accounts.mjs'
import { createQqRuntime } from './qq-napcat.mjs'
import { log, logError } from './log.mjs'

export function createRuntime({ root, cfg }) {
  const dataDir = path.join(root, 'data')
  const store = createAccountStore(path.join(dataDir, 'accounts.json'))
  const qq = createQqRuntime({
    store,
    logDir: path.join(dataDir, 'logs'),
    root
  })

  async function handle(req, res, url) {
    const method = req.method || 'GET'
    const p = url.pathname

    if (p === '/api/runtime/clients' && method === 'GET') {
      return json(res, { clients: CLIENTS })
    }

    if (p === '/api/runtime/state' && method === 'GET') {
      await qq.refreshPorts()
      return json(res, qq.snapshot())
    }

    if (p === '/api/runtime/accounts' && method === 'GET') {
      return json(res, store.list())
    }

    if (p === '/api/runtime/accounts/active' && method === 'POST') {
      const body = await readJson(req)
      try {
        store.setActive(body.id)
        log('api', `active ${body.id}`)
        qq.setActiveAccount(body.id)
        if (String(body.id).startsWith('qq:')) {
          qq.startOrQuick(body.id).catch((e) => logError('api', 'startOrQuick', e))
        }
        return json(res, qq.snapshot())
      } catch (e) {
        return json(res, { error: e.message }, 400)
      }
    }

    if (p === '/api/runtime/accounts/remove' && method === 'POST') {
      const body = await readJson(req)
      if (!body.id) return json(res, { error: 'missing_id' }, 400)
      const snap = await qq.removeAccount(body.id)
      return json(res, snap)
    }

    if (p === '/api/runtime/login/cancel' && method === 'POST') {
      const snap = await qq.cancelPending()
      return json(res, snap)
    }

    if (p === '/api/runtime/start' && method === 'POST') {
      const body = await readJson(req)
      const clientId = body.client || 'qq'
      const client = getClient(clientId)
      if (!client) return json(res, { error: 'unknown_client' }, 400)
      if (!client.enabled) {
        return json(res, {
          error: 'client_not_enabled',
          message: `${client.name} 将在后续版本接入，第一版先跑通 QQ`,
          client
        }, 501)
      }
      log('api', `start client=${clientId} mode=${body.mode || '-'} uin=${body.uin || '-'}`)
      const snap = await qq.start({
        uin: body.uin,
        forceNew: body.mode === 'new' || body.forceNew === true
      })
      return json(res, snap)
    }

    if (p === '/api/runtime/qq/qr' && method === 'GET') {
      const snap = qq.snapshot()
      const qr = snap.qr
      if (!snap.pendingAdd || snap.phase !== 'qr' || !qr.exists) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'qr_not_ready' }))
        return true
      }
      const buf = fs.readFileSync(qr.path)
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store'
      })
      res.end(buf)
      return true
    }

    if (p === '/api/runtime/stream' && method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      })
      const send = (snap) => {
        res.write(`data: ${JSON.stringify(snap)}\n\n`)
      }
      send(qq.snapshot())
      const unsub = qq.subscribe(send)
      const timer = setInterval(() => {
        qq.refreshPorts().catch(() => {})
      }, 1500)
      req.on('close', () => {
        unsub()
        clearInterval(timer)
      })
      return true
    }

    return false
  }

  return { handle, qq, store }
}

function json(res, obj, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(obj))
  return true
}

function readJson(req) {
  return new Promise((resolve) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}'))
      } catch {
        resolve({})
      }
    })
  })
}
