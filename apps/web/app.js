const $ = (id) => document.getElementById(id)

const ui = {
  list: $('account-list'),
  empty: $('empty'),
  login: $('login'),
  loginMsg: $('login-msg'),
  qr: $('qr'),
  im: $('im'),
  modal: $('modal'),
  select: $('client-select'),
  hint: $('client-hint'),
  add: $('btn-add'),
  ok: $('modal-ok'),
  cancel: $('modal-cancel')
}

let clients = []
let state = null

function show(mode) {
  ui.empty.classList.toggle('hidden', mode !== 'empty')
  ui.login.classList.toggle('hidden', mode !== 'login')
  ui.im.classList.toggle('hidden', mode !== 'im')
}

function renderAccounts(data) {
  const accounts = data?.accounts || []
  const active = data?.activeId
  ui.list.innerHTML = ''
  for (const a of accounts) {
    const btn = document.createElement('button')
    btn.className = 'avatar' + (a.id === active ? ' active' : '')
    btn.title = `${a.nickname || a.uin} · ${a.client}`
    btn.dataset.id = a.id
    const img = document.createElement('img')
    img.alt = a.nickname || a.uin
    img.src = a.avatar || `https://q1.qlogo.cn/g?b=qq&s=100&nk=${a.uin || ''}`
    const badge = document.createElement('span')
    badge.className = 'badge'
    badge.textContent = (a.client || 'qq').slice(0, 2).toUpperCase()
    btn.append(img, badge)
    btn.addEventListener('click', () => selectAccount(a.id))
    ui.list.appendChild(btn)
  }
}

function applyState(snap) {
  state = snap
  renderAccounts(snap.accounts)
  const phase = snap.phase
  if (phase === 'qr') {
    show('login')
    ui.loginMsg.textContent = snap.message || '请扫码登录'
    ui.qr.classList.remove('hidden')
    ui.qr.src = `/api/runtime/qq/qr?t=${snap.qr?.mtime || Date.now()}`
    return
  }
  if (phase === 'starting' || phase === 'logging_in') {
    show('login')
    ui.loginMsg.textContent = snap.message || '正在启动…'
    if (snap.qr?.exists) {
      ui.qr.classList.remove('hidden')
      ui.qr.src = `/api/runtime/qq/qr?t=${snap.qr.mtime}`
    }
    return
  }
  if (phase === 'ready' && snap.uin) {
    show('im')
    const token = snap.webuiToken || ''
    const next = `/plugin/napcat-plugin-ssqq/files/static/index.html${token ? `?webui_token=${encodeURIComponent(token)}` : ''}`
    if (!ui.im.getAttribute('src') || !ui.im.src.includes('/plugin/napcat-plugin-ssqq/files/static/index.html')) {
      ui.im.src = next
    }
    return
  }
  if (phase === 'error') {
    show('login')
    ui.loginMsg.textContent = snap.message || '出错了'
    return
  }
  const saved = snap.accounts?.accounts || []
  if (saved.length) {
    show('login')
    ui.loginMsg.textContent = snap.message || '正在恢复登录…'
    return
  }
  show('empty')
}

async function loadClients() {
  const res = await fetch('/api/runtime/clients')
  const data = await res.json()
  clients = data.clients || []
  ui.select.innerHTML = ''
  for (const c of clients) {
    const opt = document.createElement('option')
    opt.value = c.id
    opt.textContent = c.enabled ? c.name : `${c.name}（即将支持）`
    opt.disabled = !c.enabled
    ui.select.appendChild(opt)
  }
  ui.select.value = 'qq'
  updateHint()
}

function updateHint() {
  const c = clients.find((x) => x.id === ui.select.value)
  ui.hint.textContent = c?.enabled
    ? (c.hint || '将按该客户端方式登录')
    : '此客户端将在后续版本接入，第一版请选择 QQ'
}

async function startClient() {
  const client = ui.select.value
  ui.modal.classList.add('hidden')
  show('login')
  ui.loginMsg.textContent = '正在启动…'
  const res = await fetch('/api/runtime/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client })
  })
  const snap = await res.json()
  if (res.status === 501) {
    show('empty')
    alert(snap.message || '该客户端尚未开放')
    return
  }
  applyState(snap)
}

async function selectAccount(id) {
  await fetch('/api/runtime/accounts/active', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  })
  if (id.startsWith('qq:')) {
    show('login')
    ui.loginMsg.textContent = '正在切换账号…'
    const uin = id.slice(3)
    const snap = await (await fetch('/api/runtime/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: 'qq', uin })
    })).json()
    applyState(snap)
  }
}

function connectStream() {
  const es = new EventSource('/api/runtime/stream')
  es.onmessage = (ev) => {
    try {
      applyState(JSON.parse(ev.data))
    } catch { /* ignore */ }
  }
  es.onerror = () => {
    setTimeout(connectStream, 2000)
    es.close()
  }
}

ui.add.addEventListener('click', () => ui.modal.classList.remove('hidden'))
ui.cancel.addEventListener('click', () => ui.modal.classList.add('hidden'))
ui.ok.addEventListener('click', startClient)
ui.select.addEventListener('change', updateHint)

await loadClients()
const boot = await (await fetch('/api/runtime/state')).json()
applyState(boot)
const saved = boot.accounts?.accounts || []
const last = saved.find((a) => a.id === boot.accounts?.activeId) || saved[0]
if (boot.phase !== 'ready') {
  const body = { client: 'qq' }
  if (last?.uin) body.uin = last.uin
  if (last || boot.phase === 'qr' || boot.phase === 'logging_in' || boot.phase === 'starting') {
    fetch('/api/runtime/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).catch(() => {})
  }
}
connectStream()
