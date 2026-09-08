import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { liveNapcatSecrets, napcatPaths } from './napcat-secrets.mjs'

const { root: NAPCAT_ROOT } = napcatPaths()
const QR_PATH = path.join(NAPCAT_ROOT, 'cache/qrcode.png')
const QQ_BIN = '/Applications/QQ.app/Contents/MacOS/QQ'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function portOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const s = net.connect({ port, host })
    s.setTimeout(400)
    s.on('connect', () => {
      s.destroy()
      resolve(true)
    })
    s.on('error', () => resolve(false))
    s.on('timeout', () => {
      s.destroy()
      resolve(false)
    })
  })
}

function qrStat() {
  try {
    const st = fs.statSync(QR_PATH)
    return { exists: true, mtime: st.mtimeMs, size: st.size, path: QR_PATH }
  } catch {
    return { exists: false, mtime: 0, size: 0, path: QR_PATH }
  }
}

async function getLoginInfo() {
  const { onebot } = liveNapcatSecrets()
  const httpBase = `http://${onebot.httpHost || '127.0.0.1'}:${onebot.httpPort || 5800}`
  const tokens = [onebot.httpToken, ''].filter((t, i, a) => a.indexOf(t) === i)
  for (const token of tokens) {
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch(`${httpBase}/get_login_info`, {
        method: 'POST',
        headers,
        body: '{}',
        signal: AbortSignal.timeout(1500)
      })
      const json = await res.json()
      if (json?.status === 'ok' && json.data?.user_id) return json.data
    } catch {
      /* try next */
    }
  }
  return null
}

function findQqPids() {
  try {
    const out = execFileSync('ps', ['-ax', '-o', 'pid=,command='], { encoding: 'utf8' })
    const pids = []
    for (const line of out.split('\n')) {
      const t = line.trim()
      if (!t) continue
      const sp = t.indexOf(' ')
      const pid = Number(t.slice(0, sp))
      const cmd = t.slice(sp + 1).trim()
      if (cmd.startsWith(QQ_BIN)) pids.push(pid)
    }
    return pids
  } catch {
    return []
  }
}

export function createQqRuntime({ store, logDir }) {
  const state = {
    phase: 'idle', // idle | starting | qr | logging_in | ready | error
    message: '',
    pid: null,
    child: null,
    uin: null,
    nickname: null,
    qr: qrStat(),
    webuiUp: false,
    onebotUp: false
  }
  const listeners = new Set()

  function emit() {
    const snap = snapshot()
    for (const fn of listeners) fn(snap)
  }

  function snapshot() {
    const secrets = liveNapcatSecrets(state.uin)
    return {
      ...state,
      qr: qrStat(),
      secrets,
      webuiToken: secrets.webui.token || '',
      accounts: store.list()
    }
  }

  function subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  async function refreshPorts() {
    state.webuiUp = await portOpen(6099)
    state.onebotUp = await portOpen(5800)
    if (state.onebotUp) {
      const info = await getLoginInfo()
      if (info) {
        state.phase = 'ready'
        state.uin = String(info.user_id)
        state.nickname = info.nickname || ''
        state.message = `已登录 ${state.nickname} (${state.uin})`
        store.upsert({
          id: `qq:${state.uin}`,
          client: 'qq',
          uin: state.uin,
          nickname: state.nickname,
          avatar: `https://q1.qlogo.cn/g?b=qq&s=100&nk=${state.uin}`
        })
      }
    }
    emit()
    return snapshot()
  }

  async function spawnQq({ uin } = {}) {
    fs.mkdirSync(logDir, { recursive: true })
    const logPath = path.join(logDir, 'qq-shell.log')
    const logFd = fs.openSync(logPath, 'a')
    const args = ['--no-sandbox']
    if (uin) args.push('-q', String(uin))
    const child = spawn(QQ_BIN, args, {
      detached: true,
      stdio: ['ignore', logFd, logFd]
    })
    child.unref()
    fs.closeSync(logFd)
    state.pid = child.pid
    state.child = child
    state.message = uin ? `正在快速登录 ${uin}` : '正在启动 QQ 基座'
    emit()
    return child.pid
  }

  async function start({ uin } = {}) {
    await refreshPorts()
    if (state.phase === 'ready' && (!uin || uin === state.uin)) {
      return snapshot()
    }

    const pids = findQqPids()
    if (!pids.length) {
      state.phase = 'starting'
      state.message = '正在启动 NTQQ'
      emit()
      try {
        await spawnQq({ uin })
      } catch (e) {
        state.phase = 'error'
        state.message = `无法启动 QQ：${e.message}`
        emit()
        return snapshot()
      }
    } else {
      state.pid = pids[0]
    }

    const deadline = Date.now() + 90000
    while (Date.now() < deadline) {
      await refreshPorts()
      if (state.phase === 'ready') return snapshot()

      const qr = qrStat()
      state.qr = qr
      if (qr.exists && Date.now() - qr.mtime < 180000) {
        state.phase = 'qr'
        state.message = '请使用手机 QQ 扫描工作台中的二维码'
        emit()
      } else if (state.webuiUp && !state.onebotUp) {
        state.phase = 'logging_in'
        state.message = '等待登录完成'
        emit()
      }
      await sleep(1000)
    }

    if (state.phase !== 'ready') {
      state.phase = state.qr.exists ? 'qr' : 'error'
      if (state.phase === 'error') state.message = '启动超时，请重试'
      emit()
    }
    return snapshot()
  }

  async function startOrQuick(accountId) {
    if (!accountId) return start()
    const acc = store.list().accounts.find((a) => a.id === accountId)
    if (!acc || acc.client !== 'qq') return start()
    return start({ uin: acc.uin })
  }

  return {
    snapshot,
    subscribe,
    refreshPorts,
    start,
    startOrQuick,
    qrPath: QR_PATH,
    qqBin: QQ_BIN
  }
}
