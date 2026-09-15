import fs from 'node:fs'
import path from 'node:path'

export const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

const GATEWAY_PREFIXES = [
  '/api',
  '/i',
  '/webui',
  '/plugin',
  '/astrbot',
  '/files',
  '/mcp',
  '/onebot-ws',
  '/bot-ob',
  '/legacy',
  '/ws'
]

const GATEWAY_EXACT = new Set(['/agent.md', '/mcp.md'])

const notFound = (res) => {
  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ error: 'not_found' }))
  return true
}

function safeFilePath(rootDir, rawRelativePath) {
  let decoded
  try {
    decoded = decodeURIComponent(rawRelativePath)
  } catch {
    return null
  }
  if (decoded.includes('\0') || decoded.split('/').includes('..')) return null
  const relativePath = decoded.replace(/^\/+/, '')
  const rootWithSep = rootDir.endsWith(path.sep) ? rootDir : `${rootDir}${path.sep}`
  const file = path.resolve(rootDir, relativePath)
  if (file !== rootDir && !file.startsWith(rootWithSep)) return null
  return file
}

function hasFileExtension(pathname) {
  return /\.[^/]+$/.test(pathname)
}

function sendFile(file, res, { cacheControl, extraHeaders } = {}) {
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return false
  const ext = path.extname(file)
  const headers = { 'Content-Type': mime[ext] || 'application/octet-stream', ...extraHeaders }
  if (cacheControl) headers['Cache-Control'] = cacheControl
  res.writeHead(200, headers)
  fs.createReadStream(file).pipe(res)
  return true
}

export function isGatewayReservedPath(pathname) {
  if (GATEWAY_EXACT.has(pathname)) return true
  return GATEWAY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function redirectNextPreview(url, res) {
  if (url.pathname !== '/next' && !url.pathname.startsWith('/next/')) return false
  const rest = url.pathname === '/next' || url.pathname === '/next/'
    ? '/'
    : url.pathname.slice('/next'.length)
  res.writeHead(308, { Location: `${rest}${url.search}` })
  res.end()
  return true
}

function sendSpaIndex(rootDir, res) {
  const indexFile = safeFilePath(rootDir, '/index.html')
  if (indexFile && sendFile(indexFile, res, { cacheControl: 'no-store' })) return true
  return notFound(res)
}

export function serveProductStatic(productDir, url, res) {
  if (isGatewayReservedPath(url.pathname)) return false

  let rel = url.pathname === '/' ? '/index.html' : url.pathname
  if (rel.endsWith('/')) rel += 'index.html'
  const file = safeFilePath(productDir, rel)
  if (!file) return notFound(res)

  const cacheControl = path.basename(file) === 'index.html'
    ? 'no-store'
    : path.basename(file) === 'sw.js' || path.basename(file) === 'manifest.webmanifest'
      ? 'no-cache'
      : 'public, max-age=0, must-revalidate'
  const extraHeaders = path.basename(file) === 'sw.js'
    ? { 'Service-Worker-Allowed': '/' }
    : undefined

  if (sendFile(file, res, { cacheControl, extraHeaders })) return true
  if (!hasFileExtension(rel)) return sendSpaIndex(productDir, res)
  return notFound(res)
}

export function serveLegacyStatic(webDir, url, res) {
  if (url.pathname !== '/legacy' && !url.pathname.startsWith('/legacy/')) return false
  if (url.pathname === '/legacy') {
    res.writeHead(308, { Location: `/legacy/${url.search}` })
    res.end()
    return true
  }

  let rel = url.pathname.slice('/legacy'.length) || '/'
  if (rel === '/') rel = '/index.html'
  if (rel.endsWith('/')) rel += 'index.html'
  const file = safeFilePath(webDir, rel)
  if (!file) return notFound(res)
  const headers = {}
  if (rel === '/sw.js' || rel === '/manifest.webmanifest') headers.cacheControl = 'no-cache'
  if (rel === '/sw.js') headers.extraHeaders = { 'Service-Worker-Allowed': '/legacy/' }
  if (sendFile(file, res, headers)) return true
  return notFound(res)
}


