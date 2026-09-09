const $ = (id) => document.getElementById(id)

const ui = {
  list: $('account-list'),
  empty: $('empty'),
  login: $('login'),
  loginMsg: $('login-msg'),
  qr: $('qr'),
  im: $('im-host'),
  modal: $('modal'),
  select: $('client-select'),
  hint: $('client-hint'),
  add: $('btn-add'),
  ok: $('modal-ok'),
  cancel: $('modal-cancel'),
  loginCancel: $('login-cancel'),
  loginSteps: $('login-steps'),
  qrHint: $('qr-hint'),
  menu: $('account-menu'),
  menuBot: $('menu-bot'),
  menuRemove: $('menu-remove'),
  settings: $('btn-settings'),
  launch: $('btn-launch'),
  drop: $('client-dropdown'),
  dropBtn: $('client-drop-btn'),
  dropIcon: $('client-drop-icon'),
  dropLabel: $('client-drop-label'),
  dropMenu: $('client-drop-menu'),
  botBar: $('bot-bar'),
  botDot: $('bot-dot'),
  botStatus: $('bot-status'),
  botToggle: $('btn-bot-toggle'),
  botDash: $('btn-bot-dash'),
  dashDrawer: $('dash-drawer'),
  dashFrame: $('dash-frame'),
  dashClose: $('btn-dash-close'),
  stage: $('stage')
}

let clients = []
let selectedClientId = 'qq'
let state = null
let viewingId = null
let localAdding = sessionStorage.getItem('chihiro_adding') === '1'
let accountsWhenAdding = new Set()
const imFrames = new Map()
let botBusyId = null
let botBusyOn = false
let dashOpen = false

function setAdding(on, accountIds) {
  localAdding = on
  if (on) {
    sessionStorage.setItem('chihiro_adding', '1')
    if (accountIds) accountsWhenAdding = new Set(accountIds)
  } else {
    sessionStorage.removeItem('chihiro_adding')
  }
}

function show(mode) {
  ui.empty.classList.toggle('hidden', mode !== 'empty')
  ui.login.classList.toggle('hidden', mode !== 'login')
  ui.im.classList.toggle('hidden', mode !== 'im')
  ui.botBar?.classList.toggle('hidden', mode !== 'im')
  ui.stage?.classList.toggle('has-bot-bar', mode === 'im')
  if (mode === 'im') renderBotBar()
}

function botPhase(acc) {
  if (!acc?.online) return 'offline'
  if (botBusyId === acc.id) return botBusyOn ? 'pending-on' : 'pending-off'
  if (acc.botEnabled && acc.botWired) return 'on'
  if (acc.botEnabled && state?.astrbot?.error) return 'err'
  if (acc.botEnabled) return 'pending-on'
  return 'off'
}

function renderBotBar() {
  if (!ui.botBar) return
  const acc = viewedAccount()
  const phase = botPhase(acc)
  const running = Boolean(state?.astrbot?.running)
  const err = state?.astrbot?.error || ''
  const map = {
    offline: { dot: 'off', text: '账号离线', action: '开启 Bot', disabled: true },
    off: { dot: 'off', text: 'Bot 未开启', action: '开启 Bot', disabled: !acc?.online },
    'pending-on': { dot: 'pending', text: running ? '正在接管…' : '正在启动 AstrBot…', action: '连接中', disabled: true },
    'pending-off': { dot: 'pending', text: '正在关闭 Bot…', action: '关闭中', disabled: true },
    on: { dot: 'on', text: 'Bot 已接管此账号', action: '关闭 Bot', disabled: false },
    err: { dot: 'err', text: err || 'Bot 连接失败', action: '重试', disabled: false }
  }
  const view = map[phase] || map.off
  ui.botDot.className = `bot-dot ${view.dot}`
  ui.botStatus.textContent = view.text
  ui.botToggle.textContent = view.action
  ui.botToggle.disabled = view.disabled
  if (ui.menuBot && acc && menuAccountId === acc.id) {
    ui.menuBot.textContent = acc.botEnabled ? '关闭 Bot' : '开启 Bot'
    ui.menuBot.disabled = !acc.online || botBusyId === acc.id
  }
}

async function toggleBot(id, enabled) {
  const acc = accountsOf().find((a) => a.id === id)
  if (!id || !acc) return
  botBusyId = id
  botBusyOn = enabled
  renderBotBar()
  const res = await fetch('/api/runtime/bot/enable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, enabled })
  })
  const snap = await res.json()
  botBusyId = null
  if (!res.ok) {
    alert(snap.message || snap.error || 'Bot 开关失败')
  }
  applyState(snap)
}

function dashSrc() {
  const url = state?.astrbot?.url || 'http://127.0.0.1:6185/'
  return url.endsWith('/') ? url : `${url}/`
}

async function openDashboard() {
  dashOpen = true
  ui.dashDrawer?.classList.remove('hidden')
  ui.dashDrawer?.setAttribute('aria-hidden', 'false')
  if (!state?.astrbot?.running) {
    const res = await fetch('/api/runtime/bot/ensure', { method: 'POST' })
    const snap = await res.json()
    if (!res.ok) {
      alert(snap.message || snap.error || 'AstrBot 未能启动')
      applyState(snap)
      return
    }
    applyState(snap)
  }
  if (ui.dashFrame && ui.dashFrame.dataset.loaded !== dashSrc()) {
    ui.dashFrame.src = dashSrc()
    ui.dashFrame.dataset.loaded = dashSrc()
  }
}

function closeDashboard() {
  dashOpen = false
  ui.dashDrawer?.classList.add('hidden')
  ui.dashDrawer?.setAttribute('aria-hidden', 'true')
}

function accountsOf(data = state) {
  return data?.accounts?.accounts || []
}

function viewedAccount(data = state) {
  const accounts = accountsOf(data)
  return accounts.find((a) => a.id === viewingId)
    || accounts.find((a) => a.id === data?.accounts?.activeId)
    || accounts.find((a) => a.online)
    || null
}

function renderAccounts(data) {
  const accounts = accountsOf(data)
  const highlight = viewingId || data?.accounts?.activeId
  ui.list.innerHTML = ''
  for (const a of accounts) {
    const btn = document.createElement('button')
    btn.className = 'avatar' + (a.id === highlight ? ' active' : '')
    btn.title = `${a.nickname || a.uin} · ${a.client}${a.online ? ' · 在线' : ''}${a.botEnabled ? ' · Bot' : ''}`
    btn.dataset.id = a.id
    const img = document.createElement('img')
    img.alt = a.nickname || a.uin
    img.src = a.avatar || `https://q1.qlogo.cn/g?b=qq&s=100&nk=${a.uin || ''}`
    const badge = document.createElement('span')
    badge.className = 'badge' + (a.botEnabled ? ' bot' : '')
    badge.textContent = a.botEnabled ? 'BOT' : (a.online ? 'ON' : (a.client || 'qq').slice(0, 2).toUpperCase())
    btn.append(img, badge)
    btn.addEventListener('click', () => selectAccount(a.id))
    btn.addEventListener('contextmenu', (ev) => openAccountMenu(ev, a))
    ui.list.appendChild(btn)
  }
}

function imSrc(acc) {
  const inst = acc.instanceId
  const token = acc.webuiToken || ''
  const obTok = acc.obToken || ''
  const obAddr = inst
    ? `${location.host}/i/${encodeURIComponent(inst)}/onebot-ws`
    : (acc.obAddress || '')
  const q = new URLSearchParams()
  if (inst) q.set('chihiro_inst', inst)
  if (token) q.set('webui_token', token)
  if (obAddr) q.set('ob_address', obAddr)
  if (obTok) q.set('ob_token', obTok)
  const qs = q.toString()
  const prefix = inst ? `/i/${encodeURIComponent(inst)}` : ''
  return `${prefix}/plugin/napcat-plugin-ssqq/files/static/index.html${qs ? `?${qs}` : ''}`
}

function pruneImFrames(accounts) {
  const keep = new Set(accounts.map((a) => a.instanceId).filter(Boolean))
  for (const [id, frame] of imFrames) {
    if (keep.has(id)) continue
    frame.remove()
    imFrames.delete(id)
  }
}

function ensureImFrame(acc) {
  const inst = acc.instanceId
  if (!inst || !ui.im) return null
  let frame = imFrames.get(inst)
  if (!frame) {
    frame = document.createElement('iframe')
    frame.className = 'im-frame hidden'
    frame.title = acc.nickname || acc.uin || '千寻 IM'
    frame.dataset.instance = inst
    frame.src = imSrc(acc)
    ui.im.appendChild(frame)
    imFrames.set(inst, frame)
  }
  return frame
}

function showIm(acc) {
  if (!acc?.instanceId) return
  viewingId = acc.id
  const frame = ensureImFrame(acc)
  for (const [id, f] of imFrames) {
    f.classList.toggle('hidden', id !== acc.instanceId)
  }
  if (frame) frame.classList.remove('hidden')
}

const STEP_SHORT = ['副本', '配置', '启动', 'WebUI', '二维码', '扫码']

function renderLoginSteps(progress) {
  if (!ui.loginSteps) return
  const items = progress?.items
  if (!items?.length || progress.step > progress.total) {
    ui.loginSteps.classList.add('hidden')
    ui.loginSteps.innerHTML = ''
    return
  }
  ui.loginSteps.classList.remove('hidden')
  ui.loginSteps.innerHTML = items.map((it, i) => {
    const mark = it.state === 'done' ? '✓' : String(i + 1)
    const label = STEP_SHORT[i] || it.title
    return `<li class="${it.state}" title="${it.title}"><span class="dot">${mark}</span><span>${label}</span></li>`
  }).join('')
}

function setLoginStatus(text, { error = false } = {}) {
  if (!text) {
    ui.loginMsg.classList.add('hidden')
    ui.loginMsg.textContent = ''
    return
  }
  ui.loginMsg.classList.remove('hidden')
  ui.loginMsg.textContent = text
  ui.loginMsg.style.color = error ? '#ff6b6b' : ''
}

function setQrVisible(showQr, src) {
  if (showQr) {
    ui.qr.classList.remove('hidden')
    if (src) ui.qr.src = src
    ui.qrHint?.classList.remove('hidden')
  } else {
    ui.qr.classList.add('hidden')
    ui.qrHint?.classList.add('hidden')
  }
}

function placeholderProgress() {
  const titles = ['准备 QQ 副本', '写入独立配置', '启动 QQ 进程', '等待 WebUI', '等待二维码', '等待扫码登录']
  return {
    step: 1,
    total: titles.length,
    items: titles.map((title, i) => ({
      title,
      state: i === 0 ? 'active' : 'todo'
    }))
  }
}

function showLoginProgress(snap) {
  show('login')
  const pending = Boolean(snap.pendingAdd)
  const phase = pending ? snap.phase : 'starting'
  const progress = pending && snap.progress?.items?.length && snap.progress.step <= snap.progress.total
    ? snap.progress
    : placeholderProgress()
  renderLoginSteps(progress)
  const showQr = pending && phase === 'qr' && snap.qr?.exists
  if (showQr) {
    setQrVisible(true, `/api/runtime/qq/qr?t=${snap.qr?.mtime || Date.now()}`)
    setLoginStatus('')
  } else {
    setQrVisible(false)
    setLoginStatus(pending ? (snap.message || '正在启动…') : '正在启动新账号…')
  }
  ui.loginCancel.classList.remove('hidden')
}

function applyState(snap) {
  state = snap
  const accounts = accountsOf(snap)
  if (viewingId && !accounts.some((a) => a.id === viewingId)) viewingId = null
  pruneImFrames(accounts)

  if (localAdding) {
    renderAccounts(snap)
    const newborn = accounts.find((a) => a.online && !accountsWhenAdding.has(a.id))
    if (newborn) {
      setAdding(false)
      viewingId = newborn.id
    } else if (snap.phase === 'error') {
      show('login')
      renderLoginSteps(snap.progress)
      setQrVisible(false)
      setLoginStatus(snap.message || '出错了', { error: true })
      ui.loginCancel.classList.remove('hidden')
      return
    } else {
      showLoginProgress(snap)
      return
    }
  }

  renderAccounts(snap)
  renderLoginSteps(null)
  ui.loginCancel.classList.add('hidden')

  const chosen = viewingId ? accounts.find((a) => a.id === viewingId) : null
  if (chosen?.online && chosen.instanceId) {
    show('im')
    showIm(chosen)
    return
  }

  if (!viewingId) {
    const fallback = accounts.find((a) => a.id === snap.accounts?.activeId && a.online)
      || accounts.find((a) => a.online && a.instanceId)
    if (fallback?.instanceId) {
      viewingId = fallback.id
      show('im')
      showIm(fallback)
      return
    }
  }

  if (chosen || accounts.length) {
    show('login')
    setQrVisible(false)
    setLoginStatus(snap.message || '正在恢复登录…')
    return
  }

  show('empty')
}

let menuAccountId = null

function openAccountMenu(ev, account) {
  ev.preventDefault()
  menuAccountId = account.id
  if (ui.menuBot) {
    ui.menuBot.textContent = account.botEnabled ? '关闭 Bot' : '开启 Bot'
    ui.menuBot.disabled = !account.online
    ui.menuBot.title = account.online ? '' : '账号在线后才能开关 Bot'
  }
  ui.menu.classList.remove('hidden')
  const x = Math.min(ev.clientX, window.innerWidth - 190)
  const y = Math.min(ev.clientY, window.innerHeight - 80)
  ui.menu.style.left = `${x}px`
  ui.menu.style.top = `${y}px`
}

function hideAccountMenu() {
  ui.menu.classList.add('hidden')
  menuAccountId = null
}

async function removeAccount(id) {
  const acc = accountsOf().find((a) => a.id === id)
  const name = acc?.nickname || acc?.uin || '该账号'
  if (!confirm(`退出「${name}」并删除此号的独立运行数据？\n其他在线账号不受影响。共用 QQ 副本会保留。`)) return
  const snap = await (await fetch('/api/runtime/accounts/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  })).json()
  if (acc?.instanceId && imFrames.has(acc.instanceId)) {
    imFrames.get(acc.instanceId).remove()
    imFrames.delete(acc.instanceId)
  }
  if (viewingId === id) viewingId = null
  applyState(snap)
}

async function cancelPendingLogin() {
  setAdding(false)
  const snap = await (await fetch('/api/runtime/login/cancel', { method: 'POST' })).json()
  applyState(snap)
}

function selectedClient() {
  return clients.find((c) => c.id === selectedClientId) || clients.find((c) => c.enabled) || clients[0]
}

function paintDropTrigger() {
  const c = selectedClient()
  if (!c || !ui.dropBtn) return
  ui.dropIcon.textContent = c.badge || c.name.slice(0, 2)
  ui.dropLabel.textContent = c.name
}

function closeClientMenu() {
  if (!ui.dropMenu) return
  ui.dropMenu.classList.add('hidden')
  ui.dropBtn?.setAttribute('aria-expanded', 'false')
}

function toggleClientMenu(ev) {
  ev.stopPropagation()
  if (!ui.dropMenu) return
  const open = ui.dropMenu.classList.contains('hidden')
  ui.dropMenu.classList.toggle('hidden', !open)
  ui.dropBtn.setAttribute('aria-expanded', open ? 'true' : 'false')
}

function renderEmptyClients() {
  if (!ui.dropMenu) return
  ui.dropMenu.innerHTML = ''
  if (!clients.some((c) => c.id === selectedClientId)) {
    selectedClientId = clients.find((c) => c.enabled)?.id || clients[0]?.id || 'qq'
  }
  paintDropTrigger()
  for (const c of clients) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'client-drop-option' + (c.id === selectedClientId ? ' is-on' : '') + (c.enabled ? '' : ' is-off')
    btn.dataset.id = c.id
    btn.title = c.enabled ? (c.hint || c.name) : `${c.name} 即将支持`
    const icon = document.createElement('span')
    icon.className = 'client-drop-icon'
    icon.textContent = c.badge || c.name.slice(0, 2)
    const label = document.createElement('span')
    label.textContent = c.enabled ? c.name : `${c.name}（即将支持）`
    btn.append(icon, label)
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation()
      selectedClientId = c.id
      if (ui.select) ui.select.value = c.enabled ? c.id : ui.select.value
      closeClientMenu()
      paintDropTrigger()
      renderEmptyClients()
    })
    ui.dropMenu.appendChild(btn)
  }
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
  renderEmptyClients()
}

function updateHint() {
  const c = clients.find((x) => x.id === ui.select.value)
  ui.hint.textContent = c?.enabled
    ? (c.hint || '将按该客户端方式登录')
    : '此客户端将在后续版本接入，第一版请选择 QQ'
}

async function startClient(clientId) {
  const client = clientId || selectedClientId || ui.select.value
  const meta = clients.find((c) => c.id === client)
  if (!meta?.enabled) {
    alert(`${meta?.name || '该客户端'} 将在后续版本接入，第一版请选择 QQ`)
    return
  }
  ui.modal.classList.add('hidden')
  setAdding(true, accountsOf().map((a) => a.id))
  show('login')
  setLoginStatus('正在启动新账号…')
  setQrVisible(false)
  const res = await fetch('/api/runtime/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client, mode: 'new' })
  })
  const snap = await res.json()
  if (res.status === 501) {
    setAdding(false)
    show('empty')
    alert(snap.message || '该客户端尚未开放')
    return
  }
  applyState(snap)
}

async function selectAccount(id) {
  viewingId = id
  const acc = accountsOf().find((a) => a.id === id)
  renderAccounts(state)
  if (acc?.online && acc.instanceId) {
    setAdding(false)
    show('im')
    showIm(acc)
  }
  const snap = await (await fetch('/api/runtime/accounts/active', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  })).json()
  applyState(snap)
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

function openSettings(ev) {
  ev.preventDefault()
  const acc = viewedAccount()
  const token = acc?.webuiToken || state?.webuiToken
  const inst = acc?.instanceId
  const online = acc?.online || state?.phase === 'ready'
  if (!token || !online) {
    alert('请先登录一个 QQ 账号，再打开该账号的设置。')
    return
  }
  const next = new URL('/webui/web_login', location.origin)
  next.searchParams.set('token', token)
  if (inst) next.searchParams.set('chihiro_inst', inst)
  window.open(next.pathname + next.search, '_blank', 'noopener,noreferrer')
}

ui.settings.addEventListener('click', openSettings)
ui.add.addEventListener('click', () => ui.modal.classList.remove('hidden'))
ui.cancel.addEventListener('click', () => ui.modal.classList.add('hidden'))
ui.ok.addEventListener('click', () => startClient(ui.select.value))
ui.select.addEventListener('change', updateHint)
ui.launch?.addEventListener('click', () => startClient(selectedClientId))
ui.dropBtn?.addEventListener('click', toggleClientMenu)
ui.dropMenu?.addEventListener('click', (ev) => ev.stopPropagation())
ui.loginCancel.addEventListener('click', cancelPendingLogin)
ui.botToggle?.addEventListener('click', () => {
  const acc = viewedAccount()
  if (!acc) return
  const phase = botPhase(acc)
  const enabled = phase !== 'on'
  toggleBot(acc.id, enabled)
})
ui.botDash?.addEventListener('click', () => openDashboard())
ui.dashClose?.addEventListener('click', () => closeDashboard())
ui.menuBot?.addEventListener('click', async () => {
  const id = menuAccountId
  const acc = accountsOf().find((a) => a.id === id)
  hideAccountMenu()
  if (!id || !acc) return
  toggleBot(id, !acc.botEnabled)
})
ui.menuRemove.addEventListener('click', async () => {
  const id = menuAccountId
  hideAccountMenu()
  if (id) await removeAccount(id)
})
document.addEventListener('click', () => {
  hideAccountMenu()
  closeClientMenu()
})
ui.menu.addEventListener('click', (ev) => ev.stopPropagation())

await loadClients()
const boot = await (await fetch('/api/runtime/state')).json()
{
  const savedBoot = accountsOf(boot)
  const preferred = savedBoot.find((a) => a.id === boot.accounts?.activeId && a.online)
    || savedBoot.find((a) => a.online)
  viewingId = preferred?.id || boot.accounts?.activeId || null
  if (localAdding) {
    accountsWhenAdding = new Set(savedBoot.filter((a) => a.online).map((a) => a.id))
  }
}
applyState(boot)
const saved = accountsOf(boot)
if (boot.phase !== 'ready' && !saved.some((a) => a.online)) {
  const last = saved.find((a) => a.id === boot.accounts?.activeId) || saved[0]
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
