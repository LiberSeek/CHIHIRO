import fs from 'node:fs'
import path from 'node:path'

const prefix = '/astrbot/chihiro/'
const mime = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' }

export function serveAstrbotChatui(directory, pathname, res) {
  if (!pathname.startsWith(prefix) && pathname !== prefix.slice(0, -1)) return false
  let relative
  try { relative = decodeURIComponent(pathname.slice(prefix.length)) } catch { relative = '' }
  const file = path.resolve(directory, relative)
  if (!relative || !file.startsWith(path.resolve(directory) + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify({ error: 'chatui_asset_missing', message: '请运行 npm run rebuild:astrbot-ui' }))
    return true
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
  const stream = fs.createReadStream(file)
  stream.on('error', () => res.destroy())
  stream.pipe(res)
  return true
}

// Dedicated hosted API namespace: backend-only credentials never enter the IM
// browser storage or its NapCat requests. http-proxy preserves streaming bodies.
export function authorizeAstrbotRequest(req, url, astrbot, { websocket = false } = {}) {
  const token = astrbot.mintDashboardToken()
  req.headers.authorization = `Bearer ${token}`
  const upstream = new URL(url)
  upstream.pathname = upstream.pathname.replace(/^\/astrbot/, '')
  if (websocket || upstream.searchParams.has('token')) upstream.searchParams.set('token', token)
  req.url = upstream.pathname + upstream.search
}
