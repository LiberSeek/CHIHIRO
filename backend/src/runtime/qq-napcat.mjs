import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { liveNapcatSecrets, napcatPaths } from './napcat-secrets.mjs'
import { injectRecentContactUnread } from './chihiro-napcat-unread.mjs'
import { fetchRecentContactUnread } from './account-unread.mjs'
import { ensureStapxsSelfEvents, checkQQLoginStatus, getQQWebuiLoginInfo } from './napcat-ob11.mjs'
import { portOpen, portsForSlot, allocateIsolatedPorts, astrbotReversePort } from './qq-ports.mjs'
import { ensureQqClone } from './qq-clone.mjs'
import { log, logError } from './log.mjs'

const OFFICIAL_BIN = '/Applications/QQ.app/Contents/MacOS/QQ'
const OFFICIAL_NAPCAT = napcatPaths().root
const OFFICIAL_QR = path.join(OFFICIAL_NAPCAT, 'cache/qrcode.png')
const LOGIN_STEPS = [
  '准备 QQ 副本',
  '写入独立配置',
  '启动 QQ 进程',
  '等待 WebUI',
  '等待二维码',
  '等待扫码登录'
]
const QR_TTL_MS = 180000
const UNREAD_POLL_MS = 4000

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n')
}

function token(bytes = 8) {
  return randomBytes(bytes).toString('hex')
}

function clearQrFile(file) {
  if (!file) return
  try { fs.unlinkSync(file) } catch { /* no qr */ }
}

function qrStat(file) {
  try {
    const st = fs.statSync(file)
    const age = Date.now() - st.mtimeMs
    return {
      exists: true,
      mtime: st.mtimeMs,
      size: st.size,
      path: file,
      expired: age >= QR_TTL_MS,
      age
    }
  } catch {
    return { exists: false, mtime: 0, size: 0, path: file, expired: false, age: 0 }
  }
}

async function getLoginInfo({ httpHost = '127.0.0.1', httpPort, httpToken }) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (httpToken) headers.Authorization = `Bearer ${httpToken}`
    const res = await fetch(`http://${httpHost}:${httpPort}/get_login_info`, {
      method: 'POST',
      headers,
      body: '{}',
      signal: AbortSignal.timeout(1500)
    })
    const json = await res.json()
    if (json?.status === 'ok' && json.data?.user_id) return json.data
  } catch {
    /* ignore */
  }
  return null
}

export function parseProcessRows(execFile = execFileSync) {
  const attempts = [
    ['-eo', 'pid=,command='],
    ['-eo', 'pid=,args='],
    ['-axww', '-o', 'pid=,command='],
  ]
  for (const args of attempts) {
    try {
      const out = execFile('ps', args, { encoding: 'utf8' })
      const rows = []
      for (const line of out.split('\n')) {
        const t = line.trim()
        if (!t) continue
        const match = t.match(/^(\d+)\s+(.+)$/)
        if (!match) continue
        rows.push({ pid: Number(match[1]), cmd: match[2].trim() })
      }
      return rows
    } catch {
      // Try the next ps dialect. BusyBox rejects BSD-style -x flags, while
      // macOS may not support every GNU output column.
    }
  }
  return []
}

function listQqCommands() {
  return parseProcessRows().filter((r) =>
    r.cmd.includes('QQ.app/Contents/MacOS/QQ') &&
    r.cmd.includes('--no-sandbox') &&
    !r.cmd.includes('QQ Helper') &&
    !r.cmd.includes('QQEXDOC')
  )
}

function killPid(pid, sig = 'SIGTERM') {
  try { process.kill(pid, sig) } catch { /* already gone */ }
  try { process.kill(-pid, sig) } catch { /* no group */ }
}

function pluginSource(root) {
  const dist = path.join(root, 'dist/plugins/napcat-plugin-ssqq')
  const live = path.join(OFFICIAL_NAPCAT, 'plugins/napcat-plugin-ssqq')
  if (fs.existsSync(path.join(dist, 'webui/dist/index.html'))) return dist
  if (fs.existsSync(path.join(live, 'webui/dist/index.html'))) return live
  return null
}

function seedNapcatDir(root, napcatDir, ports, tokens) {
  const configDir = path.join(napcatDir, 'config')
  fs.mkdirSync(path.join(napcatDir, 'cache'), { recursive: true })
  fs.mkdirSync(path.join(napcatDir, 'plugins'), { recursive: true })
  fs.mkdirSync(configDir, { recursive: true })

  const officialWebui = readJson(path.join(OFFICIAL_NAPCAT, 'config/webui.json')) || {}
  writeJson(path.join(configDir, 'webui.json'), {
    ...officialWebui,
    host: '127.0.0.1',
    port: ports.webui,
    token: tokens.webui,
    autoLoginAccount: '',
    disableWebUI: false
  })

  writeJson(path.join(configDir, 'onebot11.json'), {
    network: {
      httpServers: [{
        name: 'chihiro-http',
        enable: true,
        port: ports.http,
        host: '127.0.0.1',
        enableCors: false,
        enableWebsocket: true,
        messagePostFormat: 'array',
        token: tokens.http,
        debug: false
      }],
      httpSseServers: [],
      httpClients: [],
      websocketServers: [{
        name: 'chihiro-ws',
        enable: true,
        host: '127.0.0.1',
        port: ports.ws,
        messagePostFormat: 'array',
        reportSelfMessage: true,
        token: tokens.ws,
        enableForcePushEvent: true,
        debug: false,
        heartInterval: 30000
      }],
      websocketClients: [],
      plugins: []
    },
    musicSignUrl: '',
    enableLocalFile2Url: false,
    parseMultMsg: false,
    imageDownloadProxy: ''
  })

  writeJson(path.join(configDir, 'plugins.json'), { 'napcat-plugin-ssqq': true })
  const src = pluginSource(root)
  const pluginDir = path.join(napcatDir, 'plugins/napcat-plugin-ssqq')
  if (src) {
    execFileSync('rsync', ['-a', '--delete', `${src}/`, `${pluginDir}/`])
  }
  injectRecentContactUnread(pluginDir)
}

function patchOnebotPorts(napcatDir, uin, ports, tokens) {
  const file = path.join(napcatDir, 'config', `onebot11_${uin}.json`)
  const cur = readJson(file) || readJson(path.join(napcatDir, 'config/onebot11.json'))
  if (!cur) return
  const http = (cur.network?.httpServers || [])[0]
  const ws = (cur.network?.websocketServers || [])[0]
  if (http) {
    http.port = ports.http
    http.host = http.host || '127.0.0.1'
    http.enable = true
    if (!http.token) http.token = tokens.http
  }
  if (ws) {
    ws.port = ports.ws
    ws.host = ws.host || '127.0.0.1'
    ws.enable = true
    ws.reportSelfMessage = true
    if (!ws.token) ws.token = tokens.ws
  }
  writeJson(file, cur)
}

export function createQqRuntime({ store, logDir, root }) {
  const instances = new Map()
  const unreadByAccount = new Map()
  let pendingId = null
  let officialRemoved = false
  let runSerial = 0
  const listeners = new Set()

  function accountIdForInst(inst) {
    return inst?.uin ? `qq:${inst.uin}` : null
  }

  async function refreshUnread(inst, { force = false, wait = false } = {}) {
    const accountId = accountIdForInst(inst)
    if (!accountId || inst.phase !== 'ready' || !inst.onebotUp || !inst.ports?.http) return
    if (inst.unreadInflight) {
      if (wait && inst.unreadJob) await inst.unreadJob.catch(() => {})
      return
    }
    if (!force && inst.lastUnreadAt && Date.now() - inst.lastUnreadAt < UNREAD_POLL_MS) return
    inst.unreadInflight = true
    inst.unreadJob = fetchRecentContactUnread({
      httpPort: inst.ports.http,
      httpToken: inst.tokens?.http,
    }).then((result) => {
      inst.lastUnreadAt = Date.now()
      const next = result && typeof result === 'object' ? result : { total: Number(result) || 0, peers: [] }
      const prev = unreadByAccount.get(accountId)
      unreadByAccount.set(accountId, next)
      if (JSON.stringify(prev ?? null) !== JSON.stringify(next)) emit()
    }).catch(() => {}).finally(() => {
      inst.unreadInflight = false
      inst.unreadJob = null
    })
    if (wait) await inst.unreadJob.catch(() => {})
  }

  function emit() {
    const snap = snapshot()
    for (const fn of listeners) fn(snap)
  }

  function setProgress(inst, step, label) {
    inst.message = label
    inst.progress = {
      step,
      total: LOGIN_STEPS.length,
      label,
      items: LOGIN_STEPS.map((title, i) => ({
        title,
        state: i + 1 < step ? 'done' : i + 1 === step ? 'active' : 'todo'
      }))
    }
  }

  function exitReason(code, signal) {
    if (signal === 'SIGKILL' || code === 137) return 'QQ 实例被强制结束'
    if (signal === 'SIGTERM' || code === 143) return 'QQ 实例被结束'
    if (signal) return `QQ 实例已退出 (${signal})`
    if (code === 0 || code == null) return 'QQ 实例已退出'
    return `QQ 实例异常退出 (code=${code})`
  }

  function markInstanceExited(inst, reason) {
    if (!inst || inst.stopping || inst.phase === 'idle') return false
    if (inst.phase === 'exited' && inst.message) return false
    const firstLogin = pendingId === inst.id && !inst.uin
    inst.pid = null
    inst.child = null
    inst.webuiUp = false
    inst.onebotUp = false
    inst.phase = firstLogin ? 'error' : 'exited'
    inst.message = reason || 'QQ 实例已退出'
    log('qq', `${inst.phase} ${inst.id} ${inst.message}`)
    emit()
    return true
  }

  function viewInstance() {
    if (pendingId && instances.has(pendingId)) return instances.get(pendingId)
    const activeId = store.list().activeId
    if (activeId) {
      const acc = store.list().accounts.find((a) => a.id === activeId)
      if (acc?.instanceId && instances.has(acc.instanceId)) return instances.get(acc.instanceId)
      const byUin = [...instances.values()].find((i) => i.uin && acc?.uin && String(i.uin) === String(acc.uin))
      if (byUin) return byUin
    }
    const ready = [...instances.values()].find((i) => i.phase === 'ready')
    return ready || [...instances.values()][0] || null
  }

  function proxyInstance() {
    if (pendingId) {
      const ready = [...instances.values()].find((i) => i.id !== pendingId && i.phase === 'ready')
      if (ready) return ready
    }
    return viewInstance()
  }

  function snapshot() {
    const view = viewInstance()
    const proxyInst = proxyInstance()
    const secrets = proxyInst?.kind === 'official'
      ? liveNapcatSecrets(proxyInst?.uin)
      : proxyInst
        ? { webui: { token: proxyInst.tokens.webui, port: proxyInst.ports.webui }, onebot: { wsToken: proxyInst.tokens.ws, httpToken: proxyInst.tokens.http, wsPort: proxyInst.ports.ws, httpPort: proxyInst.ports.http } }
        : liveNapcatSecrets()
    const listed = store.list()
    const accounts = (listed.accounts || []).map((a) => {
      const inst = a.instanceId ? instances.get(a.instanceId) : [...instances.values()].find((i) => i.uin && String(i.uin) === String(a.uin))
      const ports = inst?.ports || a.ports
      const tokens = inst?.tokens || a.tokens
      if (ports && !ports.astrbotReverse) ports.astrbotReverse = astrbotReversePort(ports)
      const unread = unreadByAccount.get(a.id)
      const row = {
        ...a,
        online: inst?.phase === 'ready',
        instanceId: a.instanceId || inst?.id || null,
        webui: ports?.webui ? `http://127.0.0.1:${ports.webui}` : '',
        webuiToken: tokens?.webui || '',
        obAddress: ports?.ws ? `127.0.0.1:${ports.ws}` : '',
        obToken: tokens?.ws || ''
      }
      const total = unread && typeof unread === 'object' ? unread.total : unread
      if (typeof total === 'number') row.unread = total
      else delete row.unread
      if (unread && typeof unread === 'object' && Array.isArray(unread.peers)) row.unreadPeers = unread.peers
      else delete row.unreadPeers
      return row
    })
    return {
      phase: view?.phase || 'idle',
      message: view?.message || '',
      pid: view?.pid || null,
      uin: view?.uin || null,
      nickname: view?.nickname || null,
      instanceId: view?.id || null,
      pendingAdd: Boolean(pendingId),
      qr: view && (view.phase === 'qr' || view.phase === 'qr_expired')
        ? qrStat(view.qrPath)
        : { exists: false, mtime: 0, size: 0, path: view?.qrPath || '', expired: false, age: 0 },
      webuiUp: view?.webuiUp || false,
      onebotUp: view?.onebotUp || false,
      webuiToken: view?.tokens?.webui || secrets.webui?.token || '',
      obAddress: view ? `127.0.0.1:${view.ports.ws}` : '',
      obToken: view?.tokens?.ws || '',
      proxy: proxyInst
        ? { webui: `http://127.0.0.1:${proxyInst.ports.webui}`, token: proxyInst.tokens.webui }
        : { webui: 'http://127.0.0.1:6099', token: secrets.webui?.token || '' },
      progress: view?.progress || null,
      accounts: { ...listed, accounts }
    }
  }

  function subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  function persistInstance(inst) {
    if (!inst.uin) return
    store.upsert({
      id: `qq:${inst.uin}`,
      client: 'qq',
      uin: String(inst.uin),
      nickname: inst.nickname || '',
      avatar: `https://q1.qlogo.cn/g?b=qq&s=100&nk=${inst.uin}`,
      instanceId: inst.id,
      kind: inst.kind,
      ports: inst.ports,
      tokens: inst.tokens,
      homeDir: inst.homeDir || null,
      napcatDir: inst.napcatDir || null
    }, { activate: pendingId === inst.id })
  }

  async function refreshInstance(inst) {
    if (inst.phase === 'cancelling' || inst.stopping) {
      inst.qr = qrStat(inst.qrPath)
      return inst
    }
    inst.webuiUp = await portOpen(inst.ports.webui)
    inst.onebotUp = await portOpen(inst.ports.http)
    if (inst.kind === 'isolated' && inst.uin) {
      patchOnebotPorts(inst.napcatDir, inst.uin, inst.ports, inst.tokens)
    }
    if (
      inst.kind === 'isolated'
      && inst.phase === 'ready'
      && !inst.onebotUp
      && !inst.webuiUp
    ) {
      const alive = inst.pid && listQqCommands().some((r) => r.pid === inst.pid)
      if (!alive) {
        markInstanceExited(inst, 'QQ 实例进程已退出')
        inst.qr = qrStat(inst.qrPath)
        return inst
      }
    }
    if (inst.webuiUp && inst.phase !== 'ready' && inst.tokens?.webui) {
      const webui = `http://127.0.0.1:${inst.ports.webui}`
      const token = inst.tokens.webui
      try {
        const st = await checkQQLoginStatus({ webui, token })
        const wi = inst.qqLoggedIn ? null : await getQQWebuiLoginInfo({ webui, token }).catch(() => null)
        const webUin = wi?.uin ? String(wi.uin) : ''
        if (st?.isLogin || webUin) {
          if (!inst.qqLoggedIn) log('qq', `webui login ${inst.id} uin=${webUin || inst.uin || '-'}`)
          inst.qqLoggedIn = true
          if (webUin) inst.uin = webUin
          if (wi?.nick) inst.nickname = wi.nick
          if (!inst.onebotUp) {
            inst.phase = 'logging_in'
            inst.message = '登录已确认，正在接入…'
          }
        } else if (/手Q验证/.test(st?.loginError || '')) {
          inst.phase = 'logging_in'
          inst.message = '请在手机 QQ 上确认登录'
        } else if (st?.loginError && inst.phase !== 'qr') {
          inst.message = st.loginError
        } else if (inst.uin && inst.phase !== 'qr' && inst.phase !== 'qr_expired') {
          inst.phase = 'logging_in'
          inst.message = '请在手机 QQ 上确认登录'
        }
      } catch {
        /* webui not ready */
      }
    }
    if (inst.onebotUp) {
      const info = await getLoginInfo({
        httpPort: inst.ports.http,
        httpToken: inst.tokens.http
      })
      if (info) {
        const becameReady = inst.phase !== 'ready'
        inst.phase = 'ready'
        inst.uin = String(info.user_id)
        inst.nickname = info.nickname || inst.nickname || ''
        inst.message = `已登录 ${inst.nickname} (${inst.uin})`
        inst.qqLoggedIn = true
        setProgress(inst, LOGIN_STEPS.length + 1, inst.message)
        persistInstance(inst)
        if (becameReady && inst.tokens?.webui) {
          ensureStapxsSelfEvents({
            webui: `http://127.0.0.1:${inst.ports.webui}`,
            token: inst.tokens.webui
          }).catch((e) => logError('qq', 'reportSelfMessage', e))
        }
        if (pendingId === inst.id) {
          log('qq', `login ready ${inst.id} uin=${inst.uin} ${inst.nickname}`)
          pendingId = null
        }
        void refreshUnread(inst, { force: becameReady })
      }
    }
    inst.qr = qrStat(inst.qrPath)
    if (inst.phase === 'qr' && inst.qr.expired && !inst.qqLoggedIn) {
      inst.phase = 'qr_expired'
      inst.message = '二维码已过期'
      emit()
    }
    return inst
  }

  async function refreshPorts() {
    for (const inst of instances.values()) {
      await refreshInstance(inst)
    }
    const missing = [...instances.values()].filter((inst) => (
      inst.phase === 'ready' && inst.onebotUp && inst.uin && !unreadByAccount.has(`qq:${inst.uin}`)
    ))
    if (missing.length) {
      await Promise.all(missing.map((inst) => refreshUnread(inst, { force: true, wait: true })))
    }
    emit()
    return snapshot()
  }

  async function adoptOfficial() {
    if (officialRemoved) return null
    const rows = listQqCommands().filter((r) => r.cmd.startsWith(OFFICIAL_BIN))
    const webui = await portOpen(6099)
    const onebot = await portOpen(5800)
    if (!rows.length && !webui && !onebot) return null
    const secrets = liveNapcatSecrets()
    const info = onebot
      ? await getLoginInfo({
        httpPort: secrets.onebot.httpPort || 5800,
        httpToken: secrets.onebot.httpToken || ''
      })
      : null
    const inst = {
      id: 'legacy',
      kind: 'official',
      bin: OFFICIAL_BIN,
      pid: rows[0]?.pid || null,
      child: null,
      uin: info ? String(info.user_id) : null,
      nickname: info?.nickname || '',
      phase: info ? 'ready' : (webui ? 'logging_in' : 'starting'),
      message: info ? `已登录 ${info.nickname || ''} (${info.user_id})` : '正在使用本机 QQ 基座',
      ports: {
        webui: secrets.webui.port || 6099,
        http: secrets.onebot.httpPort || 5800,
        ws: secrets.onebot.wsPort || 5801
      },
      tokens: {
        webui: secrets.webui.token || '',
        http: secrets.onebot.httpToken || '',
        ws: secrets.onebot.wsToken || ''
      },
      homeDir: null,
      napcatDir: OFFICIAL_NAPCAT,
      userDataDir: null,
      qrPath: OFFICIAL_QR,
      webuiUp: webui,
      onebotUp: onebot
    }
    instances.set(inst.id, inst)
    if (info) persistInstance(inst)
    return inst
  }

  function createIsolatedRecord({ ports, tokens }) {
    const id = `inst-${token(4)}`
    const homeDir = path.join(root, 'data/instances', id, 'home')
    const napcatDir = path.join(root, 'data/instances', id, 'napcat')
    const userDataDir = path.join(root, 'data/instances', id, 'chrome')
    fs.mkdirSync(path.join(homeDir, 'Library/Application Support/QQ'), { recursive: true })
    seedNapcatDir(root, napcatDir, ports, tokens)
    const inst = {
      id,
      kind: 'isolated',
      bin: null,
      pid: null,
      child: null,
      uin: null,
      nickname: null,
      phase: 'starting',
      message: '正在启动独立 QQ 实例',
      ports,
      tokens,
      homeDir,
      napcatDir,
      userDataDir,
      qrPath: path.join(napcatDir, 'cache/qrcode.png'),
      webuiUp: false,
      onebotUp: false
    }
    instances.set(id, inst)
    return inst
  }

  function pidsForInstance(inst) {
    if (inst.kind === 'official') {
      return listQqCommands().filter((r) => r.cmd.startsWith(OFFICIAL_BIN)).map((r) => r.pid)
    }
    const marks = [inst.userDataDir, inst.homeDir, inst.napcatDir, inst.id].filter(Boolean)
    const pids = new Set()
    if (inst.pid) pids.add(inst.pid)
    for (const row of parseProcessRows()) {
      if (marks.some((m) => m && row.cmd.includes(m))) pids.add(row.pid)
    }
    return [...pids]
  }

  async function stopInstance(inst) {
    inst.stopping = true
    const first = pidsForInstance(inst)
    log('qq', `stop ${inst.id} pids=${first.join(',') || '-'}`)
    for (const pid of first) killPid(pid, 'SIGTERM')
    const deadline = Date.now() + 2500
    while (Date.now() < deadline && pidsForInstance(inst).length) {
      await sleep(200)
    }
    for (const pid of pidsForInstance(inst)) killPid(pid, 'SIGKILL')
    await sleep(200)
    for (const pid of pidsForInstance(inst)) killPid(pid, 'SIGKILL')
    inst.pid = null
    inst.child = null
    inst.phase = 'idle'
    inst.webuiUp = false
    inst.onebotUp = false
    inst.message = '已退出'
    inst.stopping = false
    if (inst.kind !== 'official') {
      clearQrFile(inst.qrPath)
      inst.qr = qrStat(inst.qrPath)
    }
  }

  function killOrphanCloneProcesses() {
    const keep = new Set(
      (store.list().accounts || []).map((a) => a.instanceId).filter(Boolean)
    )
    for (const live of instances.values()) {
      if (live.kind === 'isolated') keep.add(live.id)
    }
    if (pendingId) keep.add(pendingId)
    const re = /\/data\/instances\/(inst-[a-f0-9]+)/i
    for (const row of parseProcessRows()) {
      const m = row.cmd.match(re)
      if (!m) continue
      if (keep.has(m[1])) continue
      log('qq', `kill orphan pid=${row.pid} inst=${m[1]}`)
      killPid(row.pid, 'SIGKILL')
    }
  }

  function instanceRootDir(inst) {
    if (inst.kind !== 'isolated') return null
    if (inst.homeDir) return path.resolve(inst.homeDir, '../..')
    return path.join(root, 'data/instances', inst.id)
  }

  function pruneOrphanInstanceDirs() {
    const dir = path.join(root, 'data/instances')
    if (!fs.existsSync(dir)) return
    const keep = new Set(
      (store.list().accounts || [])
        .map((a) => a.instanceId)
        .filter((id) => id && id !== 'legacy')
    )
    for (const live of instances.values()) {
      if (live.kind === 'isolated') keep.add(live.id)
    }
    if (pendingId) keep.add(pendingId)
    for (const name of fs.readdirSync(dir)) {
      if (!name.startsWith('inst-')) continue
      if (keep.has(name)) continue
      fs.rmSync(path.join(dir, name), { recursive: true, force: true })
    }
  }

  async function removeAccount(accountId) {
    const listed = store.list()
    const acc = listed.accounts.find((a) => a.id === accountId)
    const inst = acc?.instanceId
      ? instances.get(acc.instanceId)
      : [...instances.values()].find((i) => i.uin && acc?.uin && String(i.uin) === String(acc.uin))

    if (inst) {
      if (inst.kind === 'official') officialRemoved = true
      await stopInstance(inst)
      if (pendingId === inst.id) pendingId = null
      const disk = instanceRootDir(inst)
      const base = path.join(root, 'data/instances') + path.sep
      if (disk && (disk + path.sep).startsWith(base)) {
        fs.rmSync(disk, { recursive: true, force: true })
      }
      try { fs.unlinkSync(path.join(logDir, `qq-${inst.id}.log`)) } catch { /* optional */ }
      instances.delete(inst.id)
    }

    if (acc) store.remove(accountId)
    log('qq', `removed ${accountId} inst=${inst?.id || '-'}`)
    pruneOrphanInstanceDirs()

    const next = store.list()
    if (next.activeId) setActiveAccount(next.activeId)
    emit()
    return snapshot()
  }

  async function discardIsolated(inst) {
    if (!inst || inst.kind === 'official') return
    await stopInstance(inst)
    if (pendingId === inst.id) pendingId = null
    const disk = instanceRootDir(inst)
    const base = path.join(root, 'data/instances') + path.sep
    if (disk && (disk + path.sep).startsWith(base)) {
      fs.rmSync(disk, { recursive: true, force: true })
    }
    try { fs.unlinkSync(path.join(logDir, `qq-${inst.id}.log`)) } catch { /* optional */ }
    instances.delete(inst.id)
  }

  async function cancelPending() {
    runSerial += 1
    const targets = []
    if (pendingId && instances.has(pendingId)) targets.push(instances.get(pendingId))
    for (const inst of instances.values()) {
      if (inst.kind !== 'isolated') continue
      if (inst.uin) continue
      if (!targets.includes(inst)) targets.push(inst)
    }
    log('qq', `cancel pending=${pendingId || '-'} n=${targets.length}`)
    for (const inst of targets) {
      await discardIsolated(inst)
    }
    pendingId = null
    pruneOrphanInstanceDirs()
    killOrphanCloneProcesses()
    emit()
    return snapshot()
  }

  function loginInProgress(inst) {
    return inst && ['qr', 'qr_expired', 'starting', 'logging_in'].includes(inst.phase)
  }

  async function abortRelogin() {
    runSerial += 1
    pendingId = null
    const listed = store.list()
    const acc = listed.accounts.find((a) => a.id === listed.activeId)
      || listed.accounts[0]
    const inst = (acc?.instanceId && instances.get(acc.instanceId))
      || (acc?.uin && [...instances.values()].find((i) => i.uin && String(i.uin) === String(acc.uin)))
      || viewInstance()
      || [...instances.values()].find((i) => loginInProgress(i))
    if (!inst) {
      log('qq', 'abort relogin: no instance')
      emit()
      return snapshot()
    }
    log('qq', `abort relogin ${inst.id} phase=${inst.phase}`)
    inst.stopping = true
    inst.phase = 'cancelling'
    inst.message = '正在取消登录'
    clearQrFile(inst.qrPath)
    inst.qr = qrStat(inst.qrPath)
    emit()
    await stopInstance(inst)
    clearQrFile(inst.qrPath)
    inst.qr = qrStat(inst.qrPath)
    inst.phase = 'exited'
    inst.message = '已取消重新登录'
    emit()
    return snapshot()
  }

  async function cancelLogin() {
    const pending = pendingId && instances.get(pendingId)
    const view = viewInstance()
    const inst = pending
      || view
      || [...instances.values()].find((i) => loginInProgress(i))
    const firstLogin = Boolean(pending && !pending.uin)
    log('qq', `cancel login inst=${inst?.id || '-'} phase=${inst?.phase || '-'} pending=${pendingId || '-'} first=${firstLogin}`)
    if (firstLogin || (pending && !inst?.uin)) return cancelPending()
    if (inst) return abortRelogin()
    return cancelPending()
  }

  async function spawnInstance(inst, { uin } = {}) {
    fs.mkdirSync(logDir, { recursive: true })
    const logPath = path.join(logDir, `qq-${inst.id}.log`)
    const logFd = fs.openSync(logPath, 'a')
    const args = ['--no-sandbox']
    if (inst.userDataDir) args.push(`--user-data-dir=${inst.userDataDir}`)
    if (uin) args.push('-q', String(uin))
    const env = { ...process.env }
    if (inst.kind === 'isolated') {
      env.HOME = inst.homeDir
      env.NAPCAT_WORKDIR = inst.napcatDir
    }
    const child = spawn(inst.bin, args, {
      detached: true,
      env,
      stdio: ['ignore', logFd, logFd]
    })
    child.unref()
    fs.closeSync(logFd)
    inst.pid = child.pid
    inst.child = child
    inst.qqLoggedIn = false
    log('qq', `spawn ${inst.id} pid=${child.pid} bin=${inst.bin}`)
    log('qq', `  ports webui=${inst.ports.webui} http=${inst.ports.http} ws=${inst.ports.ws}`)
    log('qq', `  log ${logPath}`)
    child.on('exit', (code, signal) => {
      log('qq', `exit ${inst.id} pid=${child.pid} code=${code} signal=${signal}`)
      if (inst.pid && inst.pid !== child.pid) return
      markInstanceExited(inst, exitReason(code, signal))
    })
    if (!inst.progress) setProgress(inst, 3, uin ? `正在快速登录 ${uin}` : '启动 QQ 进程')
    else inst.message = uin ? `正在快速登录 ${uin}` : inst.message
    emit()
    return child.pid
  }

  async function waitForInstance(inst, { acceptSame = true, previousUin = null, serial = runSerial, qrAfter = 0 } = {}) {
    let deadline = Date.now() + 120000
    let qrAnnounced = false
    while (Date.now() < deadline) {
      if (serial !== runSerial || !instances.has(inst.id) || inst.phase === 'cancelling' || inst.stopping) return snapshot()
      await refreshInstance(inst)
      if (serial !== runSerial || !instances.has(inst.id) || inst.phase === 'cancelling' || inst.stopping) return snapshot()
      if (inst.phase === 'ready') {
        if (!acceptSame && previousUin && inst.uin === previousUin) {
          inst.phase = 'logging_in'
          inst.message = '仍是当前账号，等待新号扫码…'
        } else {
          emit()
          return snapshot()
        }
      }
      if (inst.qqLoggedIn) {
        deadline = Math.max(deadline, Date.now() + 120000)
        emit()
        await sleep(1000)
        continue
      }
      const qr = qrStat(inst.qrPath)
      const qrFresh = qr.exists && !qr.expired && qr.mtime >= qrAfter
      if (qrFresh) {
        deadline = Math.max(deadline, Date.now() + 180000)
        inst.phase = 'qr'
        setProgress(inst, 6, '请使用 QQ 扫描二维码。约两分钟有效。')
        if (!qrAnnounced) {
          log('qq', `qr ready ${inst.id}`)
          qrAnnounced = true
        }
        emit()
      } else if (inst.webuiUp && !inst.onebotUp) {
        inst.phase = 'logging_in'
        setProgress(inst, 5, inst.uin ? '请在手机 QQ 上确认登录' : '等待二维码')
        if (inst.uin) deadline = Math.max(deadline, Date.now() + 180000)
        emit()
      } else if (!inst.webuiUp) {
        setProgress(inst, 4, '等待 WebUI')
        emit()
      }
      await sleep(1000)
    }
    if (serial !== runSerial || !instances.has(inst.id) || inst.phase === 'cancelling' || inst.stopping) return snapshot()
    if (inst.phase !== 'ready') {
      if (inst.qqLoggedIn) {
        inst.phase = 'logging_in'
        inst.message = '登录已确认，正在接入…'
      } else {
        inst.phase = qrStat(inst.qrPath).exists ? 'qr' : 'error'
        if (inst.phase === 'error') inst.message = '启动超时，请重试'
      }
      emit()
    }
    return snapshot()
  }

  async function startIsolated({ uin } = {}) {
    const serial = ++runSerial
    const reserved = [...instances.values()].map((i) => i.ports)
    const allocated = await allocateIsolatedPorts(reserved)
    const tokens = { webui: token(6), http: `chihiro-http-${token(4)}`, ws: `chihiro-ws-${token(4)}` }
    const inst = createIsolatedRecord({
      ports: { webui: allocated.webui, http: allocated.http, ws: allocated.ws },
      tokens
    })
    pendingId = inst.id
    inst.phase = 'starting'
    setProgress(inst, 1, '准备 QQ 副本')
    emit()
    try {
      log('qq', `start isolated ${inst.id}${uin ? ` uin=${uin}` : ''}`)
      const clone = ensureQqClone(root)
      if (serial !== runSerial || !instances.has(inst.id)) return snapshot()
      log('qq', `clone ready ${clone.bin}`)
      inst.bin = clone.bin
      setProgress(inst, 2, '写入独立配置')
      emit()
      try { fs.unlinkSync(inst.qrPath) } catch { /* no stale qr */ }
      setProgress(inst, 3, '启动 QQ 进程')
      emit()
      const qrAfter = Date.now()
      await spawnInstance(inst, { uin })
      if (serial !== runSerial || !instances.has(inst.id)) {
        await stopInstance(inst)
        return snapshot()
      }
      const previousUin = [...instances.values()].find((i) => i.id !== inst.id && i.uin)?.uin || null
      return waitForInstance(inst, { acceptSame: false, previousUin, serial, qrAfter })
    } catch (e) {
      if (serial !== runSerial || !instances.has(inst.id)) return snapshot()
      logError('qq', `start isolated failed ${inst.id}`, e)
      inst.phase = 'error'
      inst.message = `无法启动 QQ 副本：${e.message}`
      emit()
      return snapshot()
    }
  }

  async function start({ uin, forceNew = false, refreshQr = false } = {}) {
    await refreshPorts()

    if (refreshQr && !forceNew) {
      const inst = (uin
        ? [...instances.values()].find((i) => i.uin && String(i.uin) === String(uin))
        : null)
        || (pendingId ? instances.get(pendingId) : null)
        || viewInstance()
      if (inst?.kind === 'isolated') {
        if (inst.pid) await stopInstance(inst)
        inst.phase = 'starting'
        setProgress(inst, 3, '正在刷新二维码')
        emit()
        const clone = ensureQqClone(root)
        inst.bin = clone.bin
        try { fs.unlinkSync(inst.qrPath) } catch { /* no stale qr */ }
        await spawnInstance(inst, { uin: uin || inst.uin })
        return waitForInstance(inst, { qrAfter: Date.now() })
      }
    }

    if (!forceNew && uin) {
      const existing = [...instances.values()].find((i) => i.uin && String(i.uin) === String(uin))
      if (existing?.phase === 'ready' && !refreshQr) {
        store.setActive(`qq:${uin}`)
        emit()
        return snapshot()
      }
      if (existing?.kind === 'isolated') {
        pendingId = null
        store.setActive(`qq:${uin}`)
        const dead = !existing.pid || !listQqCommands().some((r) => r.pid === existing.pid)
        const relogin = refreshQr
          || dead
          || existing.phase === 'exited'
          || existing.phase === 'qr'
          || existing.phase === 'qr_expired'
        if (relogin) {
          if (existing.pid) await stopInstance(existing)
          existing.phase = 'starting'
          setProgress(existing, 3, refreshQr ? '正在刷新二维码' : `正在恢复 ${uin}`)
          emit()
          const clone = ensureQqClone(root)
          existing.bin = clone.bin
          try { fs.unlinkSync(existing.qrPath) } catch { /* no stale qr */ }
          await spawnInstance(existing, { uin })
          return waitForInstance(existing, { qrAfter: Date.now() })
        }
        return waitForInstance(existing)
      }
      return startIsolated({ uin })
    }

    if (!forceNew && !uin) {
      const ready = [...instances.values()].find((i) => i.phase === 'ready')
      if (ready) return snapshot()
      const any = [...instances.values()][0]
      if (any) return waitForInstance(any)
      return startIsolated()
    }

    return startIsolated()
  }

  async function startOrQuick(accountId) {
    if (!accountId) return start()
    const acc = store.list().accounts.find((a) => a.id === accountId)
    if (!acc || acc.client !== 'qq') return start()
    return start({ uin: acc.uin })
  }

  function setActiveAccount(accountId) {
    log('qq', `switch active=${accountId}`)
    store.setActive(accountId)
    emit()
  }

  function proxyFromInst(inst) {
    if (!inst) return null
    return {
      id: inst.id,
      webui: `http://127.0.0.1:${inst.ports.webui}`,
      token: inst.tokens.webui,
      obAddress: `127.0.0.1:${inst.ports.ws}`,
      obToken: inst.tokens.ws,
      wsPort: inst.ports.ws,
      httpPort: inst.ports.http,
      httpToken: inst.tokens.http,
      astrbotReverse: astrbotReversePort(inst.ports)
    }
  }

  function getInstanceProxy(id) {
    if (!id) return null
    const key = String(id)
    let inst = instances.get(key)
    if (!inst) {
      const listed = store.list()
      const acc = (listed.accounts || []).find((a) =>
        a.id === key || a.instanceId === key || String(a.uin) === key
      )
      if (acc?.instanceId) inst = instances.get(acc.instanceId)
      if (!inst && acc?.uin) {
        inst = [...instances.values()].find((i) => i.uin && String(i.uin) === String(acc.uin))
      }
    }
    return proxyFromInst(inst)
  }

  function getReadyProxy() {
    const ready = [...instances.values()].find((i) => i.phase === 'ready')
    return proxyFromInst(ready) || proxyFromInst(viewInstance())
  }

  function getInstanceForAccount(accountId) {
    if (!accountId) return null
    const listed = store.list()
    const acc = (listed.accounts || []).find((a) => a.id === accountId)
    if (!acc) return null
    if (acc.instanceId && instances.has(acc.instanceId)) return instances.get(acc.instanceId)
    if (acc.uin) {
      return [...instances.values()].find((i) => i.uin && String(i.uin) === String(acc.uin)) || null
    }
    return null
  }

  function touch() {
    emit()
  }

  async function resumeAll() {
    pruneOrphanInstanceDirs()
    const saved = store.list().accounts || []
    for (const acc of saved) {
      if (acc.client !== 'qq' || !acc.uin) continue
      if ([...instances.values()].some((i) => String(i.uin) === String(acc.uin))) continue
      if (acc.kind === 'official' || acc.instanceId === 'legacy') continue
      if (acc.kind !== 'isolated' && !acc.napcatDir) continue
      const ports = acc.ports || await allocateIsolatedPorts([...instances.values()].map((i) => i.ports))
      if (!ports.astrbotReverse) ports.astrbotReverse = astrbotReversePort(ports)
      const tokens = acc.tokens || { webui: token(6), http: `chihiro-http-${token(4)}`, ws: `chihiro-ws-${token(4)}` }
      const inst = {
        id: acc.instanceId || `inst-${token(4)}`,
        kind: 'isolated',
        bin: null,
        pid: null,
        child: null,
        uin: String(acc.uin),
        nickname: acc.nickname || '',
        phase: 'starting',
        message: `正在恢复 ${acc.nickname || acc.uin}`,
        ports,
        tokens,
        homeDir: acc.homeDir || path.join(root, 'data/instances', acc.instanceId || 'x', 'home'),
        napcatDir: acc.napcatDir || path.join(root, 'data/instances', acc.instanceId || 'x', 'napcat'),
        userDataDir: path.join(root, 'data/instances', acc.instanceId || 'x', 'chrome'),
        qrPath: path.join(acc.napcatDir || path.join(root, 'data/instances', acc.instanceId || 'x', 'napcat'), 'cache/qrcode.png'),
        webuiUp: false,
        onebotUp: false
      }
      instances.set(inst.id, inst)
      try {
        const clone = ensureQqClone(root)
        inst.bin = clone.bin
        seedNapcatDir(root, inst.napcatDir, inst.ports, inst.tokens)
        const live = pidsForInstance(inst)
        if (live.length) {
          inst.pid = live[0]
          inst.phase = 'starting'
          inst.message = `正在恢复 ${acc.nickname || acc.uin}`
          log('qq', `adopt ${inst.id} pid=${inst.pid}`)
        } else {
          await spawnInstance(inst, { uin: acc.uin })
        }
      } catch (e) {
        inst.phase = 'error'
        inst.message = e.message
      }
    }
    emit()
    killOrphanCloneProcesses()
  }

  resumeAll().catch(() => {})

  return {
    snapshot,
    subscribe,
    refreshPorts,
    start,
    startOrQuick,
    setActiveAccount,
    removeAccount,
    cancelPending,
    abortRelogin,
    cancelLogin,
    getInstanceProxy,
    getReadyProxy,
    getInstanceForAccount,
    touch,
    qqBin: OFFICIAL_BIN
  }
}
