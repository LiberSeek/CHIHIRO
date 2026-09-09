import { createHash } from 'node:crypto'
import { log } from './log.mjs'

const CLIENT_NAME = 'chihiro-astrbot'
const credCache = new Map()

function passwordHash(token) {
  return createHash('sha256').update(String(token) + '.napcat').digest('hex')
}

function unwrap(body) {
  if (body && typeof body === 'object' && 'code' in body) {
    if (Number(body.code) !== 0) {
      throw new Error(body.message || 'napcat_api_error')
    }
    return body.data
  }
  return body
}

async function napcatFetch(webui, path, { token, method = 'POST', json, credential } = {}) {
  const url = `${webui.replace(/\/$/, '')}${path}`
  const headers = { 'Content-Type': 'application/json' }
  if (credential) headers.Authorization = `Bearer ${credential}`
  const res = await fetch(url, {
    method,
    headers,
    body: json === undefined ? undefined : JSON.stringify(json),
    signal: AbortSignal.timeout(8000)
  })
  const text = await res.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = { raw: text } }
  if (!res.ok) {
    throw new Error(`napcat ${path} HTTP ${res.status}`)
  }
  return { body, unwrap: unwrap(body) }
}

async function login(webui, token) {
  const key = `${webui}|${token}`
  const cached = credCache.get(key)
  if (cached && cached.until > Date.now()) return cached.credential
  const { unwrap: data } = await napcatFetch(webui, '/api/auth/login', {
    json: { hash: passwordHash(token) }
  })
  const credential = data?.Credential
  if (!credential) throw new Error('NapCat WebUI 登录失败')
  credCache.set(key, { credential, until: Date.now() + 45 * 60 * 1000 })
  return credential
}

async function withAuth(webui, token, fn) {
  let credential = await login(webui, token)
  try {
    return await fn(credential)
  } catch (e) {
    const msg = String(e.message || e)
    if (!/Unauthorized|401|登录/.test(msg)) throw e
    credCache.delete(`${webui}|${token}`)
    credential = await login(webui, token)
    return fn(credential)
  }
}

function clientMatches(entry, reverseUrl) {
  if (!entry) return false
  if (entry.name === CLIENT_NAME) return true
  const url = String(entry.url || '').replace(/\/$/, '')
  return url === reverseUrl || url === reverseUrl.replace(/\/ws$/, '') + '/ws'
}

function makeClient(reverse) {
  return {
    name: CLIENT_NAME,
    enable: true,
    url: reverse.url,
    token: reverse.token || '',
    messagePostFormat: 'array',
    reportSelfMessage: false,
    reconnectInterval: 1000,
    heartInterval: 1000,
    debug: false,
    verifyCertificate: false
  }
}

export async function getOb11Config({ webui, token }) {
  return withAuth(webui, token, async (credential) => {
    const { unwrap: data } = await napcatFetch(webui, '/api/OB11Config/GetConfig', {
      credential,
      json: {}
    })
    return data
  })
}

export async function setOb11Config({ webui, token }, config) {
  return withAuth(webui, token, async (credential) => {
    await napcatFetch(webui, '/api/OB11Config/SetConfig', {
      credential,
      json: { config: JSON.stringify(config) }
    })
  })
}

export async function setAstrbotClient({ webui, token }, reverse, enabled) {
  const config = await getOb11Config({ webui, token })
  if (!config?.network) throw new Error('NapCat OneBot 配置为空')
  const list = Array.isArray(config.network.websocketClients)
    ? [...config.network.websocketClients]
    : []
  const next = list.filter((c) => !clientMatches(c, reverse.url))
  if (enabled) next.push(makeClient(reverse))
  const before = JSON.stringify(list)
  const after = JSON.stringify(next)
  if (before === after) return { changed: false, config }
  config.network.websocketClients = next
  await setOb11Config({ webui, token }, config)
  log('bot', `${enabled ? 'wire' : 'unwire'} ${CLIENT_NAME} -> ${reverse.url}`)
  return { changed: true, config }
}

export { CLIENT_NAME }
