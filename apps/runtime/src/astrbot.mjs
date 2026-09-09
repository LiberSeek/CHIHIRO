import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { portOpen } from './qq-ports.mjs'
import { log, logError } from './log.mjs'

const execFileAsync = promisify(execFile)

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function readJson(file) {
  try {
    const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
    return JSON.parse(text)
  } catch {
    return null
  }
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n')
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

function persistLocal(root, patch) {
  const file = path.join(root, 'config/chihiro.local.json')
  const cur = readJson(file) || {}
  writeJson(file, deepMerge(cur, patch))
}

function resolveBin() {
  if (process.env.ASTRBOT_BIN && fs.existsSync(process.env.ASTRBOT_BIN)) {
    return process.env.ASTRBOT_BIN
  }
  const home = process.env.HOME || ''
  const local = path.join(home, '.local/bin/astrbot')
  if (fs.existsSync(local)) return local
  return 'astrbot'
}

async function listenerPid(port) {
  try {
    const { stdout } = await execFileAsync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'])
    const pid = Number(String(stdout).trim().split(/\n/)[0])
    return pid || null
  } catch {
    return null
  }
}

export function createAstrbotRuntime({ root, cfg }) {
  const astrCfg = cfg.astrbot || {}
  const dataDir = path.resolve(root, astrCfg.dataDir || 'data/astrbot')
  const cmdConfigPath = path.join(dataDir, 'data/cmd_config.json')
  const logDir = path.join(root, 'data/logs')
  const host = astrCfg.host || '127.0.0.1'
  const port = Number(astrCfg.port || 6185)
  const reverseHost = astrCfg.reverseHost || '127.0.0.1'
  const reversePort = Number(astrCfg.reversePort || 6199)
  const url = astrCfg.url || `http://${host}:${port}`

  let child = null
  let ownedPid = null
  let lastError = ''

  function reverseToken() {
    const existing = cfg.astrbot?.reverseToken || ''
    if (existing) return existing
    const token = `chihiro-astrbot-${randomBytes(8).toString('hex')}`
    cfg.astrbot = { ...(cfg.astrbot || {}), reverseToken: token }
    persistLocal(root, { astrbot: { reverseToken: token } })
    log('astrbot', 'generated reverseToken')
    return token
  }

  function ensureRoot() {
    fs.mkdirSync(path.join(dataDir, 'data/config'), { recursive: true })
    fs.mkdirSync(path.join(dataDir, 'data/plugins'), { recursive: true })
    fs.mkdirSync(path.join(dataDir, 'data/temp'), { recursive: true })
    const marker = path.join(dataDir, '.astrbot')
    if (!fs.existsSync(marker)) fs.writeFileSync(marker, '')
  }

  function adapterId(uin) {
    return `chihiro-qq-${uin}`
  }

  function readLiveAdapter(uin) {
    const conf = readJson(cmdConfigPath)
    const platforms = conf?.platform || []
    const adapters = platforms.filter((p) => p && p.type === 'aiocqhttp')
    const wanted = uin ? adapterId(uin) : ''
    const named = wanted ? adapters.find((p) => p.id === wanted) : null
    const chihiro = adapters.find((p) => String(p.id || '').startsWith('chihiro-qq'))
    const pick = named || chihiro || null
    if (!pick) return null
    return {
      id: pick.id,
      host: pick.ws_reverse_host || reverseHost,
      port: Number(pick.ws_reverse_port || reversePort),
      token: pick.ws_reverse_token || '',
      enable: pick.enable !== false
    }
  }

  function upsertAdapter({ uin, reversePort: rport, enable = true }) {
    ensureRoot()
    const token = reverseToken()
    const conf = readJson(cmdConfigPath) || {}
    const platforms = Array.isArray(conf.platform) ? conf.platform.slice() : []
    const id = adapterId(uin)
    const wanted = {
      id,
      type: 'aiocqhttp',
      enable: Boolean(enable),
      ws_reverse_host: '0.0.0.0',
      ws_reverse_port: Number(rport),
      ws_reverse_token: token
    }
    const idx = platforms.findIndex((p) => p?.id === id)
    if (idx >= 0) platforms[idx] = { ...platforms[idx], ...wanted }
    else platforms.push(wanted)
    conf.platform = platforms
    conf.dashboard = {
      ...(conf.dashboard || {}),
      host,
      port
    }
    writeJson(cmdConfigPath, conf)
    return wanted
  }

  function writePlatformForSpawn() {
    ensureRoot()
    const conf = readJson(cmdConfigPath) || {}
    conf.dashboard = {
      ...(conf.dashboard || {}),
      host,
      port
    }
    if (!Array.isArray(conf.platform)) conf.platform = []
    writeJson(cmdConfigPath, conf)
  }

  async function health() {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) })
      return res.ok || res.status === 200 || res.status === 401 || res.status === 403
    } catch {
      return false
    }
  }

  async function waitPort(n, ms = 20000) {
    const start = Date.now()
    while (Date.now() - start < ms) {
      if (await portOpen(n, host === '0.0.0.0' ? '127.0.0.1' : host)) return true
      await sleep(400)
    }
    return false
  }

  function status() {
    return {
      running: Boolean(ownedPid) || false,
      pid: ownedPid,
      owned: Boolean(child),
      url,
      host,
      port,
      reverseHost,
      reversePort,
      error: lastError || ''
    }
  }

  async function refreshStatus() {
    const up = await portOpen(port, '127.0.0.1')
    if (up) {
      if (!ownedPid) ownedPid = await listenerPid(port)
      lastError = lastError && child ? lastError : ''
    } else if (!child) {
      ownedPid = null
    }
    const snap = status()
    snap.running = up || Boolean(child)
    snap.pid = ownedPid
    return snap
  }

  async function adoptIfRunning() {
    if (await portOpen(port, '127.0.0.1')) {
      ownedPid = await listenerPid(port)
      child = null
      lastError = ''
      log('astrbot', `adopt pid=${ownedPid || '?'} port=${port}`)
      return true
    }
    return false
  }

  async function spawnProcess() {
    ensureRoot()
    writePlatformForSpawn()
    fs.mkdirSync(logDir, { recursive: true })
    const logPath = path.join(logDir, 'astrbot.log')
    const logFd = fs.openSync(logPath, 'a')
    const bin = resolveBin()
    const extraPath = path.join(process.env.HOME || '', '.local/bin')
    const env = {
      ...process.env,
      PATH: `${extraPath}${path.delimiter}${process.env.PATH || ''}`,
      DASHBOARD_HOST: host,
      DASHBOARD_PORT: String(port)
    }
    log('astrbot', `spawn ${bin} run -p ${port} cwd=${dataDir}`)
    child = spawn(bin, ['run', '-p', String(port)], {
      cwd: dataDir,
      env,
      stdio: ['ignore', logFd, logFd]
    })
    ownedPid = child.pid
    child.on('exit', (code, signal) => {
      log('astrbot', `exit code=${code} signal=${signal || '-'}`)
      if (child && child.pid === ownedPid) {
        child = null
        ownedPid = null
      }
      try { fs.closeSync(logFd) } catch { /* already closed */ }
    })
    const up = await waitPort(port, 25000)
    if (!up) {
      lastError = `AstrBot Dashboard 未在 ${port} 起来`
      throw new Error(lastError)
    }
    lastError = ''
    return refreshStatus()
  }

  async function ensure() {
    if (await adoptIfRunning()) {
      lastError = ''
      return refreshStatus()
    }
    return spawnProcess()
  }

  async function restartOwned() {
    const pid = ownedPid
    if (pid) {
      log('astrbot', `restart pid=${pid}`)
      try { process.kill(pid, 'SIGTERM') } catch { /* gone */ }
      const start = Date.now()
      while (Date.now() - start < 4000) {
        try {
          process.kill(pid, 0)
          await sleep(200)
        } catch {
          break
        }
      }
      try { process.kill(pid, 'SIGKILL') } catch { /* gone */ }
    }
    child = null
    ownedPid = null
    return spawnProcess()
  }

  async function ensureAdapter({ uin, reversePort: rport, enable = true }) {
    if (!uin) throw new Error('缺少账号 UIN')
    const portUse = Number(rport)
    if (!portUse) throw new Error('缺少 AstrBot 反向端口')
    const before = JSON.stringify(readLiveAdapter(uin))
    const wanted = upsertAdapter({ uin, reversePort: portUse, enable })
    const after = JSON.stringify(readLiveAdapter(uin))
    await ensure()
    const changed = before !== after
    const listening = await portOpen(portUse, '127.0.0.1')
    if (enable && (changed || !listening)) {
      log('astrbot', `reload adapter ${wanted.id} :${portUse}`)
      await restartOwned()
    }
    if (enable) {
      const up = await waitPort(portUse, 20000)
      if (!up) {
        lastError = `AstrBot 反向 WS ${portUse} 未监听（${wanted.id}）`
        throw new Error(lastError)
      }
    }
    lastError = ''
    return {
      host: '127.0.0.1',
      port: portUse,
      token: wanted.ws_reverse_token,
      url: `ws://127.0.0.1:${portUse}/ws`,
      id: wanted.id
    }
  }

  async function stopIfOwned() {
    if (!child || !ownedPid) {
      child = null
      return refreshStatus()
    }
    const pid = ownedPid
    log('astrbot', `stop owned pid=${pid}`)
    try { process.kill(pid, 'SIGTERM') } catch { /* gone */ }
    const start = Date.now()
    while (Date.now() - start < 4000) {
      try {
        process.kill(pid, 0)
        await sleep(200)
      } catch {
        child = null
        ownedPid = null
        return refreshStatus()
      }
    }
    try { process.kill(pid, 'SIGKILL') } catch { /* gone */ }
    child = null
    ownedPid = null
    return refreshStatus()
  }

  async function reverseEndpoint(uin, rport) {
    const live = uin ? readLiveAdapter(uin) : null
    const portUse = Number(rport || live?.port || reversePort)
    const token = live?.token || reverseToken()
    return {
      host: '127.0.0.1',
      port: portUse,
      token,
      url: `ws://127.0.0.1:${portUse}/ws`,
      id: live?.id || (uin ? adapterId(uin) : 'chihiro-qq')
    }
  }

  return {
    ensure,
    ensureAdapter,
    stopIfOwned,
    refreshStatus,
    status,
    reverseEndpoint,
    health,
    dataDir,
    url,
    port,
    reversePort
  }
}
