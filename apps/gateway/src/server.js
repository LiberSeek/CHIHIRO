import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import httpProxy from 'http-proxy'
import { createRuntime } from '../../runtime/src/api.mjs'
import { liveNapcatSecrets } from '../../runtime/src/napcat-secrets.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../../..')
const webDir = path.join(root, 'apps/web')

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

function liveWebuiToken() {
  return liveNapcatSecrets().webui.token
    || process.env.CHIHIRO_WEBUI_TOKEN
    || cfg.napcat.webuiToken
    || ''
}

function liveWsToken() {
  return liveNapcatSecrets().onebot.wsToken
    || process.env.CHIHIRO_ONEBOT_WS_TOKEN
    || cfg.napcat.onebotWsToken
    || ''
}

function attachNapcatAuth(req) {
  const token = liveWebuiToken()
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${host}:${port}`)

  if (url.pathname.startsWith('/api/runtime')) {
    const handled = await runtime.handle(req, res, url)
    if (handled) return
  }

  if (url.pathname.startsWith('/api/') && url.pathname !== '/api/status') {
    attachNapcatAuth(req)
    proxy.web(req, res, { target: cfg.napcat.webui })
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

  if (url.pathname.startsWith('/webui') || url.pathname.startsWith('/plugin')) {
    attachNapcatAuth(req)
    proxy.web(req, res, { target: cfg.napcat.webui })
    return
  }

  if (url.pathname.startsWith('/astrbot')) {
    req.url = (url.pathname.replace(/^\/astrbot/, '') || '/') + url.search
    proxy.web(req, res, { target: cfg.astrbot.url })
    return
  }

  if (serveStatic(url, res)) return

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'not_found', path: url.pathname }))
})

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', `http://${host}:${port}`)
  if (url.pathname.startsWith('/onebot-ws') || url.pathname === '/ws') {
    const target = cfg.napcat.onebotWs.replace(/^ws/, 'http')
    const wsToken = liveWsToken()
    if (wsToken && !req.headers.authorization) {
      req.headers.authorization = `Bearer ${wsToken}`
    }
    proxy.ws(req, socket, head, { target })
    return
  }
  if (url.pathname.startsWith('/webui') || url.pathname.startsWith('/plugin')) {
    attachNapcatAuth(req)
    proxy.ws(req, socket, head, { target: cfg.napcat.webui })
    return
  }
  socket.destroy()
})

server.listen(port, host, () => {
  console.log(`[千寻] http://${host}:${port}`)
  console.log('  工作台  打开后点 + 选择 QQ，页内扫码登录')
  console.log('  IM      登录成功后嵌入 Stapxs')
})
