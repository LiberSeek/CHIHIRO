import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const NAPCAT_ROOT = path.join(
  os.homedir(),
  'Library/Containers/com.tencent.qq/Data/Library/Application Support/QQ/NapCat'
)
const CONFIG_DIR = path.join(NAPCAT_ROOT, 'config')
const WEBUI_JSON = path.join(CONFIG_DIR, 'webui.json')

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

export function napcatPaths() {
  return { root: NAPCAT_ROOT, configDir: CONFIG_DIR, webuiJson: WEBUI_JSON }
}

export function readWebuiSecrets() {
  const j = readJson(WEBUI_JSON) || {}
  return {
    host: j.host || '127.0.0.1',
    port: Number(j.port) || 6099,
    token: j.token || ''
  }
}

export function readOnebotSecrets(uin) {
  const files = []
  try {
    for (const name of fs.readdirSync(CONFIG_DIR)) {
      if (/^onebot11_\d+\.json$/.test(name)) files.push(name)
    }
  } catch {
    return { httpToken: '', wsToken: '', httpPort: 5800, wsPort: 5801, uin: uin || null }
  }

  const prefer = uin ? `onebot11_${uin}.json` : null
  const ordered = prefer && files.includes(prefer)
    ? [prefer, ...files.filter((f) => f !== prefer)]
    : files

  for (const name of ordered) {
    const j = readJson(path.join(CONFIG_DIR, name))
    const net = j?.network || {}
    const http = (net.httpServers || []).find((s) => s.enable !== false)
    const ws = (net.websocketServers || []).find((s) => s.enable !== false)
    if (!http && !ws) continue
    return {
      uin: name.replace(/^onebot11_/, '').replace(/\.json$/, ''),
      httpToken: http?.token || '',
      wsToken: ws?.token || http?.token || '',
      httpPort: Number(http?.port) || 5800,
      wsPort: Number(ws?.port) || 5801,
      httpHost: http?.host || '127.0.0.1',
      wsHost: ws?.host || '127.0.0.1'
    }
  }

  return { httpToken: '', wsToken: '', httpPort: 5800, wsPort: 5801, uin: uin || null }
}

export function listOnebotSecrets() {
  const out = []
  try {
    for (const name of fs.readdirSync(CONFIG_DIR)) {
      if (!/^onebot11_\d+\.json$/.test(name)) continue
      const uin = name.replace(/^onebot11_/, '').replace(/\.json$/, '')
      const s = readOnebotSecrets(uin)
      if (s.httpToken || s.wsToken || s.httpPort) out.push(s)
    }
  } catch {
    /* ignore */
  }
  return out
}

export function liveNapcatSecrets(uin) {
  const webui = readWebuiSecrets()
  const onebot = readOnebotSecrets(uin)
  return { webui, onebot }
}
