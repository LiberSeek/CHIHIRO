import fs from 'node:fs'
import path from 'node:path'
import { CLIENTS, getClient } from './clients.mjs'
import { createAccountStore } from './accounts.mjs'
import { createQqRuntime } from './qq-napcat.mjs'
import { createAstrbotRuntime } from './astrbot.mjs'
import { createBotController } from './bot.mjs'
import { createAgentController } from './agent.mjs'
import { createChatuiProxy } from './chatui.mjs'
import { log, logError } from './log.mjs'

export function createRuntime({ root, cfg }) {
  const dataDir = path.join(root, 'data')
  const store = createAccountStore(path.join(dataDir, 'accounts.json'))
  const qq = createQqRuntime({
    store,
    logDir: path.join(dataDir, 'logs'),
    root
  })
  const astrbot = createAstrbotRuntime({ root, cfg })
  const agent = createAgentController({ root, store, qq, astrbot, cfg })
  const bot = createBotController({ store, qq, astrbot, cfg })
  const chatui = createChatuiProxy({ astrbot })

  async function snapshot() {
    const snap = qq.snapshot()
    snap.astrbot = await astrbot.refreshStatus()
    const wired = bot.wired
    for (const acc of snap.accounts?.accounts || []) {
      acc.botWired = wired.has(acc.id)
    }
    snap.agent = {
      pendingByAccount: agent.pendingCounts()
    }
    return snap
  }

  async function handle(req, res, url) {
    const method = req.method || 'GET'
    const p = url.pathname

    if (p === '/api/runtime/clients' && method === 'GET') {
      return json(res, { clients: CLIENTS })
    }

    if (p === '/api/runtime/state' && method === 'GET') {
      await qq.refreshPorts()
      return json(res, await snapshot())
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
        return json(res, await snapshot())
      } catch (e) {
        return json(res, { error: e.message }, 400)
      }
    }

    if (p === '/api/runtime/accounts/remove' && method === 'POST') {
      const body = await readJson(req)
      if (!body.id) return json(res, { error: 'missing_id' }, 400)
      await bot.unwireBeforeRemove(body.id).catch((e) => logError('api', 'unwire', e))
      const snap = await qq.removeAccount(body.id)
      snap.astrbot = await astrbot.refreshStatus()
      return json(res, snap)
    }

    if (p.startsWith('/api/runtime/agent')) {
      const handled = await agent.handleHttp(req, res, url)
      if (handled) return true
    }

    if (p === '/api/runtime/bot/enable' && method === 'POST') {
      const body = await readJson(req)
      if (!body.id) return json(res, { error: 'missing_id' }, 400)
      try {
        await bot.setEnabled(body.id, body.enabled !== false)
        return json(res, await snapshot())
      } catch (e) {
        logError('api', 'bot.enable', e)
        return json(res, { error: e.message, message: e.message, ...(await snapshot()) }, 400)
      }
    }

    if (p === '/api/runtime/bot/session' && method === 'POST') {
      const body = await readJson(req)
      if (!body.id || body.peerId == null) return json(res, { error: 'missing_id' }, 400)
      try {
        await bot.setSession(body.id, body.type, body.peerId, body.enabled !== false)
        return json(res, await snapshot())
      } catch (e) {
        logError('api', 'bot.session', e)
        return json(res, { error: e.message, message: e.message, ...(await snapshot()) }, 400)
      }
    }

    if (p === '/api/runtime/bot/ensure' && method === 'POST') {
      try {
        await astrbot.ensure()
        return json(res, await snapshot())
      } catch (e) {
        logError('api', 'bot.ensure', e)
        return json(res, { error: e.message, message: e.message, ...(await snapshot()) }, 400)
      }
    }

    if (p === '/api/runtime/login/cancel' && method === 'POST') {
      const snap = await qq.cancelLogin()
      snap.astrbot = await astrbot.refreshStatus()
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
        forceNew: body.mode === 'new' || body.forceNew === true,
        refreshQr: body.refreshQr === true
      })
      snap.astrbot = await astrbot.refreshStatus()
      return json(res, snap)
    }

    if (p === '/api/runtime/qq/qr' && method === 'GET') {
      const snap = qq.snapshot()
      const qr = snap.qr
      if (snap.phase !== 'qr' || !qr.exists) {
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

    if (p === '/api/runtime/image-proxy' && method === 'GET') {
      return proxyImage(res, url.searchParams.get('url') || '')
    }

    if (p.startsWith('/api/runtime/chatui')) {
      return chatui.handle(req, res, url)
    }

    if (p === '/api/runtime/stream' && method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      })
      const send = async () => {
        try {
          res.write(`data: ${JSON.stringify(await snapshot())}\n\n`)
        } catch { /* closed */ }
      }
      send()
      const unsub = qq.subscribe(() => { send() })
      const timer = setInterval(() => {
        qq.refreshPorts()
          .then(() => bot.sync())
          .catch(() => {})
      }, 1500)
      req.on('close', () => {
        unsub()
        clearInterval(timer)
      })
      return true
    }

    return false
  }

  async function shutdown() {
    await astrbot.stopIfOwned().catch((e) => logError('api', 'astrbot stop', e))
  }

  return { handle, qq, store, astrbot, bot, agent, snapshot, shutdown }
}

function json(res, obj, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(obj))
  return true
}

function isQqMediaHost(host) {
  const name = String(host || '').toLowerCase()
  return (
    name === 'multimedia.nt.qq.com.cn' ||
    name.endsWith('.qq.com') ||
    name.endsWith('.qq.com.cn') ||
    name.endsWith('.qpic.cn') ||
    name.endsWith('.qlogo.cn') ||
    name.endsWith('.gtimg.cn')
  )
}

async function proxyImage(res, raw) {
  let target
  try {
    target = new URL(raw)
  } catch {
    return json(res, { error: 'bad_url' }, 400)
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return json(res, { error: 'bad_url' }, 400)
  }
  if (!isQqMediaHost(target.hostname)) {
    return json(res, { error: 'forbidden_host' }, 403)
  }
  try {
    const upstream = await fetch(target.href, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(20000)
    })
    if (!upstream.ok) {
      return json(res, { error: 'fetch_failed', status: upstream.status }, 502)
    }
    const buf = Buffer.from(await upstream.arrayBuffer())
    if (buf.length > 20 * 1024 * 1024) {
      return json(res, { error: 'too_large' }, 413)
    }
    const contentType = (upstream.headers.get('content-type') || 'image/jpeg')
      .split(';')[0]
      .trim()
    res.writeHead(200, {
      'Content-Type': contentType.startsWith('image/') ? contentType : 'image/jpeg',
      'Cache-Control': 'private, max-age=120'
    })
    res.end(buf)
    return true
  } catch (e) {
    logError('api', 'image-proxy', e?.message || e)
    return json(res, { error: 'fetch_failed' }, 502)
  }
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
