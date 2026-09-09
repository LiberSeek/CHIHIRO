import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import httpProxy from 'http-proxy'
import { createRuntime } from '../../runtime/src/api.mjs'
import { liveNapcatSecrets } from '../../runtime/src/napcat-secrets.mjs'
import { log, logError } from '../../runtime/src/log.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../../..')
const webDir = path.join(root, 'apps/web')
const pluginStaticDir = path.join(root, 'dist/plugins/napcat-plugin-ssqq/webui/dist')
const PLUGIN_STATIC_PREFIX = '/plugin/napcat-plugin-ssqq/files/static'
const INST_PREFIX = /^\/i\/([^/]+)(?=\/|$)/

function loadConfig() {
  const defaults = JSON.parse(
    fs.readFileSync(path.join(root, 'config/chihiro.default.json'), 'utf8')
  )
  const localPath = path.join(root, 'config/chihiro.local.json')
  let local = {}
  if (fs.existsSync(localPath)) {
    local = JSON.parse(fs.readFileSync(localPath, 'utf8'))
  }
  return deepMerge(defaults, local)
}

function deepMerge(a, b) {
  if (Array.isArray(a) || Array.isArray(b) || typeof a !== 'object' || typeof b !== 'object' || !a || !b) {
    return b === undefined ? a : b
  }
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) {
    out[k] = k in a ? deepMerge(a[k], v) : v
  }
  return out
}

const cfg = loadConfig()
const host = cfg.gateway.host || '127.0.0.1'
const port = cfg.gateway.port || 3100

const runtime = createRuntime({ root, cfg })

function activeProxy() {
  try {
    return runtime.qq.snapshot().proxy || {}
  } catch {
    return {}
  }
}

function liveWebuiToken() {
  return activeProxy().token
    || liveNapcatSecrets().webui.token
    || process.env.CHIHIRO_WEBUI_TOKEN
    || cfg.napcat.webuiToken
    || ''
}

function liveWsToken() {
  const snap = runtime.qq.snapshot()
  return snap.obToken
    || liveNapcatSecrets().onebot.wsToken
    || process.env.CHIHIRO_ONEBOT_WS_TOKEN
    || cfg.napcat.onebotWsToken
    || ''
}

function liveWebuiTarget() {
  return activeProxy().webui
    || cfg.napcat.webui
    || 'http://127.0.0.1:6099'
}

function astrbotTarget() {
  return cfg.astrbot?.url || 'http://127.0.0.1:6185'
}

function instanceIdFromReq(req, url) {
  const fromPath = url.pathname.match(INST_PREFIX)
  if (fromPath) return decodeURIComponent(fromPath[1])
  const fromQuery = url.searchParams.get('chihiro_inst')
  if (fromQuery) return fromQuery
  const ref = req.headers.referer || ''
  if (!ref) return null
  try {
    const ru = new URL(ref)
    const m = ru.pathname.match(INST_PREFIX)
    if (m) return decodeURIComponent(m[1])
    return ru.searchParams.get('chihiro_inst') || null
  } catch {
    return null
  }
}

function stripInstancePrefix(pathname) {
  const next = pathname.replace(INST_PREFIX, '')
  return next || '/'
}

function resolveNapcat(instanceId, { preferReady = false } = {}) {
  const named = instanceId ? runtime.qq.getInstanceProxy(instanceId) : null
  if (named) return named
  if (preferReady) {
    const ready = runtime.qq.getReadyProxy?.()
    if (ready) return ready
  }
  return {
    id: null,
    webui: liveWebuiTarget(),
    token: liveWebuiToken(),
    obToken: liveWsToken(),
    wsPort: Number(String(runtime.qq.snapshot().obAddress || '').split(':')[1]) || null
  }
}

function attachWsAuth(req, napcat) {
  const token = napcat?.obToken || liveWsToken()
  if (token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${token}`
  }
}

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ws: true,
  xfwd: true
})
proxy.on('error', (err, _req, res) => {
  logError('gw', 'proxy', err.message)
  if (res && !res.headersSent && typeof res.writeHead === 'function') {
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'bad_gateway', message: err.message }))
  }
})

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8'
}

function serveStatic(url, res) {
  let rel = url.pathname === '/' ? '/index.html' : url.pathname
  if (rel.includes('..')) return false
  const file = path.join(webDir, rel)
  if (!file.startsWith(webDir)) return false
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return false
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
  return true
}

function servePluginStatic(pathname, res) {
  const routed = stripInstancePrefix(pathname)
  if (!routed.startsWith(PLUGIN_STATIC_PREFIX)) return false
  let rel = routed.slice(PLUGIN_STATIC_PREFIX.length) || '/index.html'
  if (rel.endsWith('/')) rel += 'index.html'
  if (!rel.startsWith('/')) rel = `/${rel}`
  if (rel.includes('..')) return false
  const file = path.join(pluginStaticDir, rel)
  if (!file.startsWith(pluginStaticDir)) return false
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return false
  const ext = path.extname(file)
  res.writeHead(200, {
    'Content-Type': mime[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' || ext === '.js' ? 'no-store' : 'public, max-age=0, must-revalidate'
  })
  fs.createReadStream(file).pipe(res)
  return true
}

function proxyWebui(req, res, url, napcat) {
  req.url = stripInstancePrefix(url.pathname) + url.search
  proxy.web(req, res, { target: napcat.webui })
}

function emptyWebuiPage(res) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(`<!doctype html><meta charset="utf-8"><title>千寻</title>
<body style="font-family:system-ui;background:#111;color:#f2f2f7;display:grid;place-items:center;height:100vh;margin:0">
<p>请先在千寻登录一个 QQ 账号，再打开设置。</p>
<p><a href="/" style="color:#12b7f5">返回工作台</a></p>
</body>`)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${host}:${port}`)
  const instanceId = instanceIdFromReq(req, url)
  const routedPath = stripInstancePrefix(url.pathname)

  if (url.pathname.startsWith('/api/runtime')) {
    if (url.pathname !== '/api/runtime/stream' && url.pathname !== '/api/runtime/state' && url.pathname !== '/api/runtime/qq/qr') {
      log('gw', req.method, url.pathname)
    }
    const handled = await runtime.handle(req, res, url)
    if (handled) return
  }

  if (routedPath.startsWith('/api/') && routedPath !== '/api/status') {
    const napcat = resolveNapcat(instanceId, { preferReady: !instanceId })
    req.url = routedPath + url.search
    proxy.web(req, res, { target: napcat.webui })
    return
  }

  if (url.pathname === '/api/status') {
    const snap = await runtime.qq.refreshPorts()
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({
      service: 'chihiro',
      gateway: { host, port },
      runtime: snap
    }, null, 2))
    return
  }

  if (url.pathname === '/im' || url.pathname === '/im/') {
    res.writeHead(302, { Location: '/' })
    res.end()
    return
  }

  if (
    routedPath === '/webui' ||
    routedPath === '/webui/' ||
    routedPath === '/webui/web_login'
  ) {
    const napcat = resolveNapcat(instanceId)
    const token = napcat.token || liveWebuiToken()
    if (!token) {
      emptyWebuiPage(res)
      return
    }
    const inst = instanceId || napcat.id
    const needsToken = !url.searchParams.get('token')
    const needsInst = inst && !url.searchParams.get('chihiro_inst')
    const onPrefixedPath = INST_PREFIX.test(url.pathname)
    if (needsToken || needsInst || onPrefixedPath) {
      const next = new URL('/webui/web_login', `http://${host}:${port}`)
      next.searchParams.set('token', url.searchParams.get('token') || token)
      if (inst) next.searchParams.set('chihiro_inst', inst)
      res.writeHead(302, { Location: next.pathname + next.search })
      res.end()
      return
    }
  }

  if (url.pathname.startsWith('/files/') || routedPath.startsWith('/files/')) {
    const napcat = resolveNapcat(instanceId, { preferReady: true })
    req.url = (url.pathname.startsWith('/files/') ? url.pathname : routedPath) + url.search
    proxy.web(req, res, { target: napcat.webui })
    return
  }

  if (servePluginStatic(url.pathname, res)) return

  if (routedPath.startsWith('/webui') || routedPath.startsWith('/plugin')) {
    const napcat = resolveNapcat(instanceId, { preferReady: routedPath.startsWith('/plugin') })
    proxyWebui(req, res, url, napcat)
    return
  }

  if (url.pathname.startsWith('/astrbot')) {
    req.url = (url.pathname.replace(/^\/astrbot/, '') || '/') + url.search
    proxy.web(req, res, { target: astrbotTarget() })
    return
  }

  if (serveStatic(url, res)) return

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'not_found', path: url.pathname }))
})

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', `http://${host}:${port}`)
  const instanceId = instanceIdFromReq(req, url)
  const routedPath = stripInstancePrefix(url.pathname)

  if (
    routedPath.startsWith('/onebot-ws') ||
    routedPath === '/ws' ||
    routedPath === '/onebot-ws'
  ) {
    const napcat = resolveNapcat(instanceId)
    const wsPort = napcat.wsPort
      || Number(String(runtime.qq.snapshot().obAddress || '').split(':')[1])
    const target = wsPort
      ? `http://127.0.0.1:${wsPort}`
      : cfg.napcat.onebotWs.replace(/^ws/, 'http')
    attachWsAuth(req, napcat)
    req.url = `/${url.search || ''}`
    proxy.ws(req, socket, head, { target })
    return
  }
  if (url.pathname.startsWith('/astrbot') || routedPath.startsWith('/astrbot')) {
    req.url = (url.pathname.replace(/^\/astrbot/, '') || '/') + url.search
    proxy.ws(req, socket, head, { target: astrbotTarget() })
    return
  }
  if (routedPath.startsWith('/webui') || routedPath.startsWith('/plugin') || routedPath.startsWith('/api/')) {
    const napcat = resolveNapcat(instanceId, { preferReady: routedPath.startsWith('/plugin') })
    req.url = routedPath + url.search
    proxy.ws(req, socket, head, { target: napcat.webui })
    return
  }
  socket.destroy()
})

let shuttingDown = false
async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  log('gw', `shutdown ${signal}`)
  try {
    await runtime.shutdown?.()
  } catch (e) {
    logError('gw', 'shutdown', e)
  }
  process.exit(0)
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

server.listen(port, host, () => {
  log('gw', `listening http://${host}:${port}`)
  log('gw', '工作台打开后点 + 选择 QQ，页内扫码登录（使用 QQ 副本，不占用原生 QQ）')
})
