import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config/chihiro.default.json'), 'utf8'))
const localPath = path.join(root, 'config/chihiro.local.json')
if (fs.existsSync(localPath)) {
  Object.assign(cfg.napcat, JSON.parse(fs.readFileSync(localPath, 'utf8')).napcat || {})
}

async function check(name, url, headers = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 1500)
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal })
    console.log(`${name.padEnd(16)} OK  ${res.status}  ${url}`)
  } catch (e) {
    console.log(`${name.padEnd(16)} DOWN ${url}  (${e.message})`)
  } finally {
    clearTimeout(t)
  }
}

const token = process.env.CHIHIRO_ONEBOT_HTTP_TOKEN || cfg.napcat.onebotHttpToken
await check('gateway', `http://${cfg.gateway.host}:${cfg.gateway.port}/api/status`)
await check('napcat-webui', `${cfg.napcat.webui}/webui/`)
await check('onebot-http', `${cfg.napcat.onebotHttp}/get_login_info`, token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' })
await check('astrbot', cfg.astrbot.url)
