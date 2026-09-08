import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import httpProxy from 'http-proxy'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../../..')

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

function envOr(cfgVal, envName) {
  if (envName && process.env[envName]) return process.env[envName]
  return cfgVal
}

const cfg = loadConfig()
const host = cfg.gateway.host || '127.0.0.1'
const port = cfg.gateway.port || 3100

const webuiToken = envOr(cfg.napcat.webuiToken, cfg.napcat.webuiTokenEnv)
const onebotHttpToken = envOr(cfg.napcat.onebotHttpToken, cfg.napcat.onebotHttpTokenEnv)
const onebotWsToken = envOr(cfg.napcat.onebotWsToken, cfg.napcat.onebotWsTokenEnv)

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

function htmlHome() {
  const imHref = cfg.stapxs.pluginPage
    ? `${cfg.napcat.webui}${cfg.stapxs.pluginPage}${webuiToken ? `?webui_token=${encodeURIComponent(webuiToken)}` : ''}`
    : '/im/'
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>千寻 Chihiro</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f141a; color: #e8eef5; }
    main { width: min(720px, 92vw); padding: 28px; border-radius: 18px; background: #18212b; border: 1px solid #2a3644; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    p { margin: 0 0 18px; color: #9fb0c3; line-height: 1.5; }
    .grid { display: grid; gap: 12px; }
    a.card { display: block; padding: 14px 16px; border-radius: 12px; text-decoration: none; color: inherit; background: #101820; border: 1px solid #2a3644; }
    a.card:hover { border-color: #4f8cff; }
    .title { font-weight: 650; margin-bottom: 4px; }
    .meta { font-size: 13px; color: #8aa0b5; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  </style>
</head>
<body>
  <main>
    <h1>千寻 Chihiro</h1>
    <p>统一入口：IM（Stapxs）/ NapCat 运维 / AstrBot。本机 Gateway 只做聚合，不替代 NapCat Shell。</p>
    <div class="grid">
      <a class="card" href="${imHref}" target="_blank" rel="noreferrer">
        <div class="title">IM 聊天 · Stapxs QQ Lite</div>
        <div class="meta">连接 OneBot WS <code>${cfg.stapxs.connect.address}</code> · token 见 local 配置</div>
      </a>
      <a class="card" href="/webui/" target="_blank" rel="noreferrer">
        <div class="title">NapCat WebUI · Settings</div>
        <div class="meta">插件 / 网络 / 调试 · ${cfg.napcat.webui}</div>
      </a>
      <a class="card" href="/astrbot/" target="_blank" rel="noreferrer">
        <div class="title">AstrBot</div>
        <div class="meta">自动化与 Agent · ${cfg.astrbot.url}</div>
      </a>
      <a class="card" href="/api/status">
        <div class="title">运行状态</div>
        <div class="meta">JSON health check</div>
      </a>
    </div>
  </main>
</body>
</html>`
}

async function probe(url, headers = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 1200)
  try {
    const res = await fetch(url, { method: 'GET', headers, signal: ctrl.signal })
    return { ok: res.ok || res.status < 500, status: res.status }
  } catch (e) {
    return { ok: false, error: String(e.message || e) }
  } finally {
    clearTimeout(t)
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${host}:${port}`)

  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(htmlHome())
    return
  }

  if (url.pathname === '/api/status') {
    const [webui, onebot, astrbot] = await Promise.all([
      probe(`${cfg.napcat.webui}/webui/`),
      probe(`${cfg.napcat.onebotHttp}/get_version_info`, onebotHttpToken ? { Authorization: `Bearer ${onebotHttpToken}` } : {}),
      probe(cfg.astrbot.url)
    ])
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({
      service: 'chihiro-gateway',
      gateway: { host, port },
      targets: {
        napcatWebui: { url: cfg.napcat.webui, ...webui },
        onebotHttp: { url: cfg.napcat.onebotHttp, ...onebot },
        onebotWs: cfg.napcat.onebotWs,
        astrbot: { url: cfg.astrbot.url, ...astrbot },
        stapxsConnect: cfg.stapxs.connect
      }
    }, null, 2))
    return
  }

  if (url.pathname === '/im' || url.pathname === '/im/') {
    const target = `${cfg.napcat.webui}${cfg.stapxs.pluginPage}`
    const q = new URLSearchParams(url.search)
    if (webuiToken && !q.has('webui_token')) q.set('webui_token', webuiToken)
    res.writeHead(302, { Location: `${target}?${q.toString()}` })
    res.end()
    return
  }

  if (url.pathname.startsWith('/webui') || url.pathname.startsWith('/plugin')) {
    proxy.web(req, res, { target: cfg.napcat.webui })
    return
  }

  if (url.pathname.startsWith('/astrbot')) {
    // strip prefix
    req.url = url.pathname.replace(/^\/astrbot/, '') + url.search || '/'
    if (req.url === '') req.url = '/'
    proxy.web(req, res, { target: cfg.astrbot.url })
    return
  }

  if (url.pathname.startsWith('/onebot')) {
    req.url = url.pathname.replace(/^\/onebot/, '') + url.search || '/'
    if (req.url === '') req.url = '/'
    const headers = {}
    if (onebotHttpToken) headers.Authorization = `Bearer ${onebotHttpToken}`
    proxy.web(req, res, { target: cfg.napcat.onebotHttp, headers })
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'not_found', path: url.pathname }))
})

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', `http://${host}:${port}`)
  if (url.pathname.startsWith('/onebot-ws') || url.pathname === '/ws') {
    // forward to NapCat OneBot WS
    const target = cfg.napcat.onebotWs.replace(/^ws/, 'http')
    if (onebotWsToken && !req.headers.authorization) {
      req.headers.authorization = `Bearer ${onebotWsToken}`
    }
    proxy.ws(req, socket, head, { target })
    return
  }
  if (url.pathname.startsWith('/webui') || url.pathname.startsWith('/plugin')) {
    proxy.ws(req, socket, head, { target: cfg.napcat.webui })
    return
  }
  socket.destroy()
})

server.listen(port, host, () => {
  console.log(`[chihiro-gateway] http://${host}:${port}`)
  console.log(`  home     -> http://${host}:${port}/`)
  console.log(`  im       -> http://${host}:${port}/im/`)
  console.log(`  webui    -> http://${host}:${port}/webui/`)
  console.log(`  astrbot  -> http://${host}:${port}/astrbot/`)
  console.log(`  status   -> http://${host}:${port}/api/status`)
  console.log(`  stapxs connect: ${cfg.stapxs.connect.address} (token via CHIHIRO_ONEBOT_WS_TOKEN / chihiro.local.json)`)
})
