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
  menuRemove: $('menu-remove'),
  launch: $('btn-launch'),
  drop: $('client-dropdown'),
  dropBtn: $('client-drop-btn'),
  dropIcon: $('client-drop-icon'),
  dropLabel: $('client-drop-label'),
  dropMenu: $('client-drop-menu'),
  botDot: $('bot-dot'),
  botStatus: $('agentic-status'),
  botToggle: $('agentic-switch'),
  paneAgentic: $('pane-agentic'),
  agenticList: $('agentic-list'),
  agenticDetail: $('agentic-detail'),
  agenticBack: $('agentic-back'),
  agenticPeer: $('agentic-peer'),
  agenticThread: $('agentic-thread'),
  agenticDrafts: $('agentic-drafts'),
  agenticInput: $('agentic-input'),
  agenticAsk: $('agentic-ask'),
  agenticQuote: $('agentic-quote'),
  agenticQuoteText: $('agentic-quote-text'),
  agenticQuoteClear: $('agentic-quote-clear'),
  agenticPermBtn: $('agentic-perm-btn'),
  agenticPermMenu: $('agentic-perm-menu'),
  agenticPermLabel: $('agentic-perm-label'),
  dashDrawer: $('dash-drawer'),
  dashFrame: $('dash-frame'),
  dashClose: $('btn-dash-close'),
  dashTitle: $('dash-title'),
  dashHint: $('dash-hint'),
  confirm: $('confirm-dialog'),
  confirmTitle: $('confirm-title'),
  confirmBody: $('confirm-body'),
  confirmOk: $('confirm-ok'),
  confirmCancel: $('confirm-cancel'),
  stage: $('stage'),
  workspace: $('workspace'),
  feature: $('feature'),
  featureTabs: $('feature-tabs'),
  leaving: $('leaving')
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
let featureOpen = false
let featureTab = 'agentic'
let imChat = null
let leavingId = null
const unreadByInst = new Map()
let agentState = { sessions: [], drafts: [] }
let agentOpenKey = null
let agentQuote = ''
let agentEs = null
let agentStreamAccount = null
let agentStreamTimer = null
let agentStreamWanted = false

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
  ui.leaving?.classList.toggle('hidden', mode !== 'leaving')
  if (mode === 'im') {
    renderBotBar()
    renderFeature()
    connectAgentStream()
  } else {
    setFeatureOpen(false)
    stopAgentStream()
  }
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
  if (!ui.botToggle && !ui.botStatus) return
  const acc = viewedAccount()
  const phase = botPhase(acc)
  const map = {
    offline: { text: '未托管', disabled: true, on: false, hosted: false },
    off: { text: '未托管', disabled: !acc?.online, on: false, hosted: false },
    'pending-on': { text: '启动中', disabled: true, on: true, hosted: false },
    'pending-off': { text: '关闭中', disabled: true, on: false, hosted: false },
    on: { text: '已托管', disabled: false, on: true, hosted: true },
    err: { text: '未托管', disabled: false, on: false, hosted: false }
  }
  const view = map[phase] || map.off
  if (ui.botStatus) {
    ui.botStatus.textContent = view.text
    ui.botStatus.classList.toggle('is-on', view.hosted)
  }
  if (ui.botToggle) {
    ui.botToggle.checked = view.on
    ui.botToggle.disabled = view.disabled
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
  openDrawer({
    title: 'AstrBot 设置',
    hint: '模型、白名单和插件在这里配置',
    src: dashSrc()
  })
}

function closeDashboard() {
  ui.dashDrawer?.classList.add('hidden')
  ui.dashDrawer?.setAttribute('aria-hidden', 'true')
}

function openDrawer({ title, hint, src }) {
  if (ui.dashTitle) ui.dashTitle.textContent = title
  if (ui.dashHint) ui.dashHint.textContent = hint || ''
  ui.dashDrawer?.classList.remove('hidden')
  ui.dashDrawer?.setAttribute('aria-hidden', 'false')
  if (ui.dashFrame && src && ui.dashFrame.dataset.loaded !== src) {
    ui.dashFrame.src = src
    ui.dashFrame.dataset.loaded = src
  }
}

function napcatSettingsUrl() {
  const acc = viewedAccount()
  const token = acc?.webuiToken
  const inst = acc?.instanceId
  if (!token || !inst) return ''
  // NapCat SPA basename is `/webui/`; a prefixed `/i/{inst}/webui` URL renders blank.
  const next = new URL('/webui/web_login', location.origin)
  next.searchParams.set('token', token)
  next.searchParams.set('chihiro_inst', inst)
  return next.pathname + next.search
}

function setFeatureOpen(on) {
  featureOpen = Boolean(on)
  ui.feature?.classList.toggle('hidden', !featureOpen)
  ui.feature?.setAttribute('aria-hidden', featureOpen ? 'false' : 'true')
  if (featureOpen) renderFeature()
}

function setFeatureTab(tab) {
  featureTab = 'agentic'
  ui.paneAgentic?.classList.remove('hidden')
  ui.feature?.classList.add('is-agentic')
  if (tab === 'agentic') renderAgentic()
}

function renderFeature() {
  renderBotBar()
  setFeatureTab('agentic')
  renderAgentic()
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]))
}

const AGENT_STATUS = {
  idle: '空闲',
  processing: '处理中',
  pending_review: '待你确认',
  replied: '已回复'
}

const MODE_UI = {
  ask: { chip: '请求批准', warn: false },
  auto: { chip: '帮我批准', warn: false },
  always: { chip: '完全访问', warn: true }
}

const thinkOpen = new Set()

function syncPermUi(mode) {
  const m = MODE_UI[mode] || MODE_UI.always
  if (ui.agenticPermLabel) ui.agenticPermLabel.textContent = m.chip
  ui.agenticPermBtn?.classList.toggle('is-always', Boolean(m.warn))
  ui.agenticPermBtn?.classList.toggle('is-ask', mode === 'ask')
  ui.agenticPermMenu?.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.classList.toggle('is-on', btn.dataset.mode === mode)
  })
}

function closePermMenu() {
  ui.agenticPermMenu?.classList.add('hidden')
}

function setAgentQuote(text) {
  agentQuote = String(text || '').trim()
  if (ui.agenticQuoteText) ui.agenticQuoteText.textContent = agentQuote
  ui.agenticQuote?.classList.toggle('hidden', !agentQuote)
}

function clearAgentQuote() {
  setAgentQuote('')
}

function stepIcon(kind) {
  if (kind === 'query') return '🔍'
  if (kind === 'reply') return '💬'
  if (kind === 'act') return '⚡'
  if (kind === 'recv') return '•'
  if (kind === 'mode') return '•'
  return '•'
}

function renderThink(m) {
  const running = m.status === 'running'
  const open = running || thinkOpen.has(m.id)
  const label = running ? '正在思考' : '已思考'
  const steps = (m.steps || []).map((s) => {
    const det = s.detail ? `<span class="det">${escapeHtml(s.detail)}</span>` : ''
    return `<li><span class="ttl">${stepIcon(s.kind)} ${escapeHtml(s.title)}</span>${det}</li>`
  }).join('')
  return `<div class="agentic-think ${open ? 'is-open' : ''}" data-id="${escapeHtml(m.id)}" data-think="1">
    <button type="button" class="agentic-think-toggle" data-think-toggle="${escapeHtml(m.id)}">
      <span class="agentic-think-label">
        ${running ? '<span class="agentic-think-dot"></span>' : ''}
        <span>${label}</span>
      </span>
      <span class="agentic-think-caret"></span>
    </button>
    <ul class="agentic-think-steps">${steps}</ul>
  </div>`
}

function stopAgentStream() {
  agentStreamWanted = false
  if (agentStreamTimer) {
    clearTimeout(agentStreamTimer)
    agentStreamTimer = null
  }
  if (agentEs) {
    try { agentEs.close() } catch { /* ignore */ }
    agentEs = null
  }
  agentStreamAccount = null
}

function connectAgentStream() {
  const acc = viewedAccount()
  if (!acc?.id) {
    stopAgentStream()
    return
  }
  agentStreamWanted = true
  if (agentEs && agentStreamAccount === acc.id && agentEs.readyState !== EventSource.CLOSED) return
  if (agentEs) {
    try { agentEs.close() } catch { /* ignore */ }
    agentEs = null
  }
  agentStreamAccount = acc.id
  const es = new EventSource(`/api/runtime/agent/stream?accountId=${encodeURIComponent(acc.id)}`)
  agentEs = es
  es.onmessage = (ev) => {
    try {
      agentState = JSON.parse(ev.data) || agentState
      renderAgentic()
    } catch { /* ignore */ }
  }
  es.onerror = () => {
    if (es.readyState !== EventSource.CLOSED) return
    if (agentEs === es) agentEs = null
    if (!agentStreamWanted || agentStreamTimer) return
    agentStreamTimer = setTimeout(() => {
      agentStreamTimer = null
      if (agentStreamWanted && !agentEs) connectAgentStream()
    }, 3000)
  }
}

function renderAgentic() {
  if (!ui.agenticList) return
  const acc = viewedAccount()
  const inDetail = Boolean(agentOpenKey)
  ui.agenticList.classList.toggle('hidden', inDetail)
  ui.agenticDetail?.classList.toggle('hidden', !inDetail)
  if (!inDetail) {
    const sessions = agentState.sessions || []
    if (!sessions.length) {
      ui.agenticList.classList.add('is-empty')
      ui.agenticList.innerHTML = '<p class="agentic-empty">暂无会话/任务</p>'
    } else {
      ui.agenticList.classList.remove('is-empty')
      ui.agenticList.innerHTML = sessions.map((s) => {
        const st = AGENT_STATUS[s.status] || s.status || '空闲'
        const id = s.peerId || ''
        const preview = escapeHtml(s.lastText || s.title || '')
        return `<button type="button" class="agentic-item" data-key="${escapeHtml(s.key)}">
          <div class="meta"><div class="id">ID: ${escapeHtml(id)}</div><div class="preview">${preview}</div></div>
          <span class="st ${escapeHtml(s.status || '')}">${st}</span>
          <span class="go">›</span>
        </button>`
      }).join('')
    }
    return
  }
  const session = (agentState.sessions || []).find((s) => s.key === agentOpenKey)
  if (!session) {
    agentOpenKey = null
    renderAgentic()
    return
  }
  if (ui.agenticPeer) ui.agenticPeer.textContent = `${session.title || session.peerId} · ${session.peerId}`
  syncPermUi(session.mode || 'always')
  const msgs = session.messages || []
  if (ui.agenticThread) {
    ui.agenticThread.querySelectorAll('.agentic-think[data-id]').forEach((el) => {
      if (el.classList.contains('is-open')) thinkOpen.add(el.dataset.id)
      else thinkOpen.delete(el.dataset.id)
    })
    const el = ui.agenticThread
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48
    ui.agenticThread.innerHTML = msgs.map((m) => {
      if (m.role === 'thinking') return renderThink(m)
      if (m.role === 'draft') return ''
      const role = m.role === 'operator' ? 'operator' : m.role === 'bot' ? 'bot' : 'user'
      const text = escapeHtml(m.text || '')
      return `<div class="agentic-bubble ${role}">${text}</div>`
    }).join('')
    if (atBottom) ui.agenticThread.scrollTop = ui.agenticThread.scrollHeight
  }
  const drafts = (agentState.drafts || []).filter((d) => d.sessionKey === session.key)
  if (ui.agenticDrafts) {
    if (!drafts.length) ui.agenticDrafts.innerHTML = ''
    else {
      ui.agenticDrafts.innerHTML = drafts.map((d) => `<div class="agentic-draft-card">
        <div>待确认发送 · ${escapeHtml(d.reason === 'auto_sensitive' ? '自动模式拦截敏感内容' : d.reason === 'assist' ? '协助回复' : '询问模式')}</div>
        <div>${escapeHtml(d.text || '')}</div>
        <div class="row">
          <button type="button" class="btn" data-approve="${escapeHtml(d.id)}">发送</button>
          <button type="button" class="btn ghost" data-discard="${escapeHtml(d.id)}">丢弃</button>
        </div>
      </div>`).join('')
    }
  }
}

async function openAgentSession(key) {
  agentOpenKey = key
  clearAgentQuote()
  const acc = viewedAccount()
  if (!acc) return
  try {
    const data = await (await fetch(`/api/runtime/agent/session?key=${encodeURIComponent(key)}`)).json()
    if (data.session) {
      const list = agentState.sessions || []
      const i = list.findIndex((s) => s.key === key)
      if (i >= 0) list[i] = { ...list[i], ...data.session }
      else list.unshift(data.session)
      agentState.sessions = list
      if (data.session.drafts) {
        const others = (agentState.drafts || []).filter((d) => d.sessionKey !== key)
        agentState.drafts = others.concat(data.session.drafts)
      }
    }
  } catch { /* ignore */ }
  renderAgentic()
}

async function setAgentMode(mode) {
  const acc = viewedAccount()
  if (!acc) return
  const session = (agentState.sessions || []).find((s) => s.key === agentOpenKey)
  await fetch('/api/runtime/agent/mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session
      ? { accountId: acc.id, peerId: session.peerId, type: session.type, mode }
      : { accountId: acc.id, mode })
  })
}

async function agentAskOrSend() {
  const acc = viewedAccount()
  const session = (agentState.sessions || []).find((s) => s.key === agentOpenKey)
  const text = ui.agenticInput?.value?.trim() || ''
  if (!acc || !session || (!text && !agentQuote)) return
  const res = await fetch('/api/runtime/agent/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: acc.id,
      peerId: session.peerId,
      type: session.type,
      text,
      quote: agentQuote || undefined
    })
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    alert(body.message || body.error || '发送失败')
    return
  }
  if (ui.agenticInput) {
    ui.agenticInput.value = ''
    ui.agenticInput.style.height = 'auto'
  }
  clearAgentQuote()
}

function applyQuoteFromChat(data) {
  const acc = viewedAccount()
  if (!acc || !data) return
  const type = data.type === 'group' ? 'group' : 'private'
  const peerId = String(data.peerId || '')
  if (!peerId) return
  const key = `${acc.id}:${type}:${peerId}`
  setFeatureOpen(true)
  setFeatureTab('agentic')
  agentOpenKey = key
  const list = agentState.sessions || []
  if (!list.some((s) => s.key === key)) {
    list.unshift({
      key,
      accountId: acc.id,
      type,
      peerId,
      title: data.title || peerId,
      messages: [],
      status: 'idle',
      mode: 'always'
    })
    agentState.sessions = list
  }
  setAgentQuote(data.text || '')
  renderAgentic()
  ui.agenticInput?.focus()
}

function onImMessage(ev) {
  const data = ev.data
  if (!data || data.source !== 'chihiro-im') return
  if (data.kind === 'unread') {
    if (data.instanceId) unreadByInst.set(data.instanceId, Number(data.count) || 0)
    renderAccounts()
    return
  }
  if (data.kind === 'toggle-feature') {
    setFeatureOpen(!featureOpen)
    return
  }
  if (data.kind === 'quote-bot') {
    applyQuoteFromChat(data)
    return
  }
  if (data.kind === 'chat') {
    imChat = data.chat || null
    renderFeature()
    return
  }
  if (data.kind === 'open-settings') {
    if (data.target === 'astrbot') {
      openDashboard()
      return
    }
    if (data.target === 'napcat') {
      const src = napcatSettingsUrl()
      if (!src) {
        alert('请先登录一个 QQ 账号，再打开 NapCat 设置。')
        return
      }
      if (ui.dashFrame) ui.dashFrame.dataset.loaded = ''
      openDrawer({ title: 'NapCat 设置', hint: '当前 QQ 实例的 OneBot / 网络配置', src })
    }
  }
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
    btn.append(img)
    if (a.botEnabled) {
      const badge = document.createElement('span')
      badge.className = 'badge'
      badge.textContent = 'BOT'
      btn.append(badge)
    }
    const unread = unreadByInst.get(a.instanceId) || 0
    if (unread > 0) {
      const n = document.createElement('span')
      n.className = 'unread'
      n.textContent = unread > 99 ? '99+' : String(unread)
      btn.append(n)
    }
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

function discardImFrame(inst) {
  if (!inst || !imFrames.has(inst)) return
  const frame = imFrames.get(inst)
  frame.classList.add('hidden')
  try { frame.src = 'about:blank' } catch { /* ignore */ }
  frame.remove()
  imFrames.delete(inst)
}

function neighborAccount(id, accounts = accountsOf()) {
  const idx = accounts.findIndex((a) => a.id === id)
  const usable = (a) => a && a.id !== id && a.online && a.instanceId
  if (idx >= 0) {
    for (let i = idx + 1; i < accounts.length; i++) if (usable(accounts[i])) return accounts[i]
    for (let i = idx - 1; i >= 0; i--) if (usable(accounts[i])) return accounts[i]
  }
  return accounts.find(usable) || null
}

function ensureImFrame(acc) {
  const inst = acc.instanceId
  if (!inst || !ui.im) return null
  if (leavingId && acc.id === leavingId) return null
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

  if (leavingId) {
    renderAccounts(snap)
    const chosen = viewingId ? accounts.find((a) => a.id === viewingId) : null
    if (chosen?.online && chosen.instanceId && chosen.id !== leavingId) {
      show('im')
      showIm(chosen)
      return
    }
    show('leaving')
    return
  }

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

function askConfirm({ title, body, okText = '确定' }) {
  return new Promise((resolve) => {
    if (!ui.confirm) {
      resolve(window.confirm(body || title))
      return
    }
    ui.confirmTitle.textContent = title || '确认'
    ui.confirmBody.textContent = body || ''
    ui.confirmOk.textContent = okText
    ui.confirm.classList.remove('hidden')
    ui.confirm.setAttribute('aria-hidden', 'false')
    const finish = (ok) => {
      ui.confirm.classList.add('hidden')
      ui.confirm.setAttribute('aria-hidden', 'true')
      ui.confirmOk.removeEventListener('click', onOk)
      ui.confirmCancel.removeEventListener('click', onCancel)
      ui.confirm.removeEventListener('click', onBackdrop)
      document.removeEventListener('keydown', onKey)
      resolve(ok)
    }
    const onOk = () => finish(true)
    const onCancel = () => finish(false)
    const onBackdrop = (ev) => { if (ev.target === ui.confirm) finish(false) }
    const onKey = (ev) => { if (ev.key === 'Escape') finish(false) }
    ui.confirmOk.addEventListener('click', onOk)
    ui.confirmCancel.addEventListener('click', onCancel)
    ui.confirm.addEventListener('click', onBackdrop)
    document.addEventListener('keydown', onKey)
    ui.confirmOk.focus()
  })
}

async function removeAccount(id) {
  const accounts = accountsOf()
  const acc = accounts.find((a) => a.id === id)
  const name = acc?.nickname || acc?.uin || '该账号'
  const ok = await askConfirm({
    title: '退出账号',
    body: `确定退出「${name}」吗？其他在线账号不受影响。共用 QQ 副本会保留。`,
    okText: '退出账号'
  })
  if (!ok) return

  const next = neighborAccount(id, accounts)
  leavingId = id
  if (next?.online && next.instanceId) {
    viewingId = next.id
    show('im')
    showIm(next)
  } else {
    viewingId = null
    show('leaving')
  }
  discardImFrame(acc?.instanceId)

  let snap
  try {
    const res = await fetch('/api/runtime/accounts/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    snap = await res.json()
    if (!res.ok) {
      leavingId = null
      alert(snap.message || snap.error || '退出账号失败')
      applyState(snap)
      return
    }
  } catch (err) {
    leavingId = null
    alert(err?.message || '退出账号失败')
    return
  }

  leavingId = null
  if (viewingId === id) viewingId = next?.id || null
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
  if (leavingId && id === leavingId) return
  if (id !== viewingId) {
    agentOpenKey = null
    clearAgentQuote()
    agentStreamAccount = null
  }
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

ui.add.addEventListener('click', () => ui.modal.classList.remove('hidden'))
ui.cancel.addEventListener('click', () => ui.modal.classList.add('hidden'))
ui.ok.addEventListener('click', () => startClient(ui.select.value))
ui.select.addEventListener('change', updateHint)
ui.launch?.addEventListener('click', () => startClient(selectedClientId))
ui.dropBtn?.addEventListener('click', toggleClientMenu)
ui.dropMenu?.addEventListener('click', (ev) => ev.stopPropagation())
ui.loginCancel.addEventListener('click', cancelPendingLogin)
ui.botToggle?.addEventListener('change', () => {
  const acc = viewedAccount()
  if (!acc) return
  toggleBot(acc.id, ui.botToggle.checked)
})
ui.agenticList?.addEventListener('click', (ev) => {
  const item = ev.target.closest('[data-key]')
  if (item?.dataset.key) openAgentSession(item.dataset.key)
})
ui.agenticBack?.addEventListener('click', () => {
  agentOpenKey = null
  clearAgentQuote()
  renderAgentic()
})
ui.agenticPermBtn?.addEventListener('click', (ev) => {
  ev.stopPropagation()
  ui.agenticPermMenu?.classList.toggle('hidden')
})
ui.agenticPermMenu?.addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-mode]')
  if (!btn?.dataset.mode) return
  setAgentMode(btn.dataset.mode)
  syncPermUi(btn.dataset.mode)
  closePermMenu()
})
ui.agenticAsk?.addEventListener('click', () => agentAskOrSend())
ui.agenticQuoteClear?.addEventListener('click', () => clearAgentQuote())
ui.agenticInput?.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && !ev.shiftKey) {
    ev.preventDefault()
    agentAskOrSend()
  }
})
ui.agenticInput?.addEventListener('input', () => {
  const el = ui.agenticInput
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`
})
ui.agenticThread?.addEventListener('click', (ev) => {
  const toggle = ev.target.closest('[data-think-toggle]')
  if (!toggle) return
  const wrap = toggle.closest('.agentic-think')
  const id = wrap?.dataset.id
  if (!id) return
  const open = wrap.classList.toggle('is-open')
  if (open) thinkOpen.add(id)
  else thinkOpen.delete(id)
})
document.addEventListener('click', (ev) => {
  if (ev.target.closest('.agentic-perm')) return
  closePermMenu()
})
ui.agenticDrafts?.addEventListener('click', async (ev) => {
  const approve = ev.target.closest('[data-approve]')
  const discard = ev.target.closest('[data-discard]')
  const id = approve?.dataset.approve || discard?.dataset.discard
  if (!id) return
  const path = approve ? '/api/runtime/agent/draft/approve' : '/api/runtime/agent/draft/discard'
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) alert(body.message || body.error || '操作失败')
})
ui.dashClose?.addEventListener('click', () => closeDashboard())
ui.dashDrawer?.addEventListener('click', (ev) => {
  if (ev.target === ui.dashDrawer) closeDashboard()
})
ui.featureTabs?.addEventListener('click', (ev) => {
  const btn = ev.target.closest('button[data-tab]')
  if (btn?.dataset.tab) setFeatureTab(btn.dataset.tab)
})
window.addEventListener('message', onImMessage)
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

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
}
