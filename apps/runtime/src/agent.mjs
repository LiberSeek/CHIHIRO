import { WebSocketServer, WebSocket } from 'ws'
import { log, logError } from './log.mjs'
import { createAgentStore, sessionKey, MODES } from './agent-store.mjs'
import { astrbotReversePort } from './qq-ports.mjs'
import path from 'node:path'

const OPERATOR_PREFIX = '[Chihiro操作员]'

function ob11TextSegment(text) {
  return { type: 'text', data: { text: String(text ?? '') } }
}

function operatorOb11Event({ type, peerId, selfId, payload }) {
  const isGroup = type === 'group'
  const id = Number(peerId)
  const messageId = Date.now() % 1e9
  const event = {
    post_type: 'message',
    message_type: isGroup ? 'group' : 'private',
    sub_type: isGroup ? 'normal' : 'friend',
    user_id: id,
    self_id: Number(selfId),
    time: Math.floor(Date.now() / 1000),
    message_id: messageId,
    message_seq: messageId,
    font: 14,
    message_format: 'array',
    message: [ob11TextSegment(payload)],
    raw_message: payload,
    sender: { user_id: id, nickname: 'Chihiro' }
  }
  if (isGroup) event.group_id = id
  return event
}

function messageText(message) {
  if (message == null) return ''
  if (typeof message === 'string') return message
  if (!Array.isArray(message)) return String(message)
  return message.map((seg) => {
    if (typeof seg === 'string') return seg
    const t = seg?.type
    const data = seg?.data || seg
    if (t === 'text') return data.text || ''
    if (t === 'image') return '[图片]'
    if (t === 'video') return '[视频]'
    if (t === 'record') return '[语音]'
    if (t === 'at') return `@${data.qq || data.user_id || ''}`
    if (t === 'face') return '[表情]'
    return ''
  }).join('')
}

function isSendAction(msg) {
  const action = String(msg?.action || '')
  return action === 'send_msg' || action === 'send_private_msg' || action === 'send_group_msg'
}

function outboundTarget(msg) {
  const p = msg?.params || {}
  const action = String(msg.action || '')
  if (action === 'send_group_msg' || p.group_id) {
    return { type: 'group', peerId: String(p.group_id), message: p.message }
  }
  const peer = p.user_id ?? p.id
  return { type: 'private', peerId: String(peer || ''), message: p.message }
}

function looksSensitive(text, message) {
  const raw = `${text || ''} ${typeof message === 'string' ? message : JSON.stringify(message || '')}`
  if (/https?:\/\//i.test(raw)) return true
  if (Array.isArray(message) && message.some((s) => {
    const t = s?.type
    return t === 'image' || t === 'video' || t === 'file' || (t === 'at' && String(s?.qq || s?.data?.qq) === 'all')
  })) return true
  if (/\[CQ:(image|video|file|at,qq=all)/i.test(raw)) return true
  return false
}

function fakeOk(echo) {
  return JSON.stringify({
    status: 'ok',
    retcode: 0,
    data: { message_id: Date.now() % 1e9 },
    echo
  })
}

function parseJson(raw) {
  try {
    return JSON.parse(String(raw))
  } catch {
    return null
  }
}

function clipText(s, n = 80) {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  return t.length > n ? `${t.slice(0, n)}…` : t
}

const SKIP_ACTIONS = new Set(['', 'get_status', 'get_version_info', 'get_online_clients', '.handle'])

function describeAction(msg) {
  const action = String(msg?.action || '')
  if (SKIP_ACTIONS.has(action) || !action) return null
  const p = msg.params || {}
  const table = {
    get_login_info: { kind: 'query', title: '读取当前账号' },
    get_stranger_info: { kind: 'query', title: `查询用户 ${p.user_id || ''}`.trim() },
    get_friend_list: { kind: 'query', title: '获取好友列表' },
    get_group_info: { kind: 'query', title: `查询群 ${p.group_id || ''}`.trim() },
    get_group_list: { kind: 'query', title: '获取群列表' },
    get_group_member_info: { kind: 'query', title: `查询群成员 ${p.user_id || ''}`.trim() },
    get_group_member_list: { kind: 'query', title: '获取群成员' },
    get_msg: { kind: 'query', title: '读取历史消息' },
    send_like: { kind: 'act', title: '点赞' },
    delete_msg: { kind: 'act', title: '撤回消息' },
    set_group_ban: { kind: 'act', title: '禁言' },
    set_group_kick: { kind: 'act', title: '移出群成员' },
    set_friend_add_request: { kind: 'act', title: '处理好友申请' },
    set_group_add_request: { kind: 'act', title: '处理加群申请' },
    send_private_msg: { kind: 'reply', title: '起草私聊回复' },
    send_group_msg: { kind: 'reply', title: '起草群聊回复' },
    send_msg: { kind: 'reply', title: '起草回复' }
  }
  if (table[action]) return table[action]
  if (action.startsWith('get_')) return { kind: 'query', title: action }
  if (action.startsWith('send_') || action.startsWith('set_')) return { kind: 'act', title: action }
  return { kind: 'tool', title: action }
}

const MODE_STEP = {
  ask: '权限为「请求批准」，回复会先给你确认',
  auto: '权限为「帮我批准」，仅拦截链接、图片、@全体',
  always: '权限为「完全访问」，回复将直接发出'
}

export function createAgentController({ root, store: accounts, qq, astrbot, cfg }) {
  const persist = createAgentStore(path.join(root, 'data/agent/state.json'))
  const listeners = new Set()
  const bridges = new Map()
  const wss = new WebSocketServer({ noServer: true })

  function emit() {
    const snap = view()
    for (const fn of listeners) {
      try { fn(snap) } catch { /* ignore */ }
    }
  }

  function subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  function view(accountId) {
    const sessions = persist.listSessions(accountId).map((s) => {
      const pending = persist.listDrafts(s.accountId, 'pending').filter((d) => d.sessionKey === s.key)
      let status = s.status || 'idle'
      if (pending.length) status = 'pending_review'
      return {
        ...s,
        mode: persist.sessionMode(s),
        pendingDrafts: pending.length,
        status
      }
    })
    return {
      accountModes: persist.load().accountModes || {},
      sessions,
      drafts: persist.listDrafts(accountId, 'pending'),
      pendingByAccount: persist.pendingCounts()
    }
  }

  function finishThinking(key) {
    persist.updateMessages(key, (messages) => {
      const next = messages.slice()
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === 'thinking' && next[i].status === 'running') {
          next[i] = { ...next[i], status: 'done', text: '已思考' }
          break
        }
      }
      return next
    })
  }

  function startThinking(key, steps) {
    finishThinking(key)
    persist.appendMessage(key, {
      id: `think-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      role: 'thinking',
      status: 'running',
      text: '正在思考',
      steps: steps || [],
      at: Date.now()
    })
  }

  function addThinkStep(key, step) {
    if (!key || !step?.title) return
    let found = false
    persist.updateMessages(key, (messages) => {
      const next = messages.slice()
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === 'thinking') {
          found = true
          const prev = next[i].steps || []
          const last = prev[prev.length - 1]
          if (last?.title === step.title && last?.detail === (step.detail || '')) return next
          const steps = [...prev, { kind: step.kind || 'tool', title: step.title, detail: step.detail || '', at: Date.now() }]
          next[i] = {
            ...next[i],
            status: 'running',
            text: '正在思考',
            steps: steps.length > 40 ? steps.slice(-40) : steps
          }
          return next
        }
      }
      return next
    })
    if (!found) {
      startThinking(key, [{ kind: step.kind || 'tool', title: step.title, detail: step.detail || '', at: Date.now() }])
    }
  }

  function sessionKeyFromAction(accountId, msg) {
    const target = outboundTarget(msg)
    if (target.peerId && target.peerId !== 'undefined' && target.peerId !== 'null') {
      return sessionKey(accountId, target.type, target.peerId)
    }
    const p = msg?.params || {}
    const groupId = p.group_id
    const userId = p.user_id ?? p.id
    if (groupId) return sessionKey(accountId, 'group', groupId)
    if (userId) return sessionKey(accountId, 'private', userId)
    const hot = persist.listSessions(accountId).find((s) => s.status === 'processing')
    return hot?.key || persist.listSessions(accountId)[0]?.key || ''
  }

  function ingestUser(accountId, data) {
    const type = data.message_type === 'group' ? 'group' : 'private'
    const peerId = type === 'group' ? data.group_id : (data.user_id ?? data.sender?.user_id)
    if (!accountId || peerId == null) return
    const key = sessionKey(accountId, type, peerId)
    const text = messageText(data.message) || data.raw_message || ''
    const nickname = data.sender?.nickname || data.sender?.card || ''
    persist.upsertSession({
      key,
      accountId,
      type,
      peerId,
      title: type === 'group' ? (data.group_name || String(peerId)) : (nickname || String(peerId)),
      lastText: text,
      lastAt: Date.now(),
      status: 'processing',
      assistHold: false
    })
    persist.appendMessage(key, {
      id: String(data.message_id || `u-${Date.now()}`),
      role: 'user',
      text,
      at: Date.now()
    })
    const mode = persist.sessionMode(persist.getSession(key))
    startThinking(key, [
      { kind: 'recv', title: '收到对方消息', detail: clipText(text), at: Date.now() },
      { kind: 'mode', title: MODE_STEP[mode] || MODE_STEP.always, detail: '', at: Date.now() }
    ])
    emit()
  }

  function decideOutbound(accountId, msg) {
    const target = outboundTarget(msg)
    if (!target.peerId) return { hold: false }
    const key = sessionKey(accountId, target.type, target.peerId)
    const session = persist.getSession(key) || persist.upsertSession({
      key, accountId, type: target.type, peerId: target.peerId, lastAt: Date.now(), status: 'processing'
    })
    const text = messageText(target.message)
    const mode = persist.sessionMode(session)
    const assist = Boolean(session.assistHold)
    let hold = false
    let reason = ''
    if (assist || mode === 'ask') {
      hold = true
      reason = assist ? 'assist' : 'ask'
    } else if (mode === 'auto' && looksSensitive(text, target.message)) {
      hold = true
      reason = 'auto_sensitive'
    }
    addThinkStep(key, {
      kind: 'reply',
      title: hold ? '起草回复，等待你确认' : '起草回复',
      detail: clipText(text)
    })
    if (hold) {
      addThinkStep(key, {
        kind: 'mode',
        title: reason === 'auto_sensitive' ? '自动模式拦截了链接/图片/@全体' : '按「请求批准」拦截，待你确认'
      })
      finishThinking(key)
      const draft = persist.addDraft({
        accountId,
        sessionKey: key,
        type: target.type,
        peerId: target.peerId,
        text,
        message: target.message,
        reason,
        echo: msg.echo
      })
      persist.upsertSession({
        ...persist.getSession(key),
        key,
        lastText: text,
        lastAt: Date.now(),
        status: 'pending_review',
        assistHold: false
      })
      persist.appendMessage(key, {
        id: draft.id,
        role: 'draft',
        text,
        at: Date.now(),
        draftId: draft.id
      })
      emit()
      return { hold: true, draft }
    }
    addThinkStep(key, { kind: 'reply', title: '已发出回复', detail: clipText(text) })
    finishThinking(key)
    persist.upsertSession({
      ...persist.getSession(key),
      key,
      lastText: text,
      lastAt: Date.now(),
      status: 'replied',
      assistHold: false
    })
    persist.appendMessage(key, {
      id: `b-${Date.now()}`,
      role: 'bot',
      text,
      at: Date.now()
    })
    emit()
    return { hold: false }
  }

  function instForAccount(accountId) {
    return qq.getInstanceForAccount?.(accountId) || null
  }

  async function napcatSend(accountId, { type, peerId, message }) {
    const inst = instForAccount(accountId)
    if (!inst?.ports?.http) throw new Error('账号未在线')
    const action = type === 'group' ? 'send_group_msg' : 'send_private_msg'
    const body = type === 'group'
      ? { group_id: Number(peerId), message }
      : { user_id: Number(peerId), message }
    const res = await fetch(`http://127.0.0.1:${inst.ports.http}/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${inst.tokens.http}`
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000)
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || (json.status && json.status !== 'ok' && json.retcode && json.retcode !== 0)) {
      throw new Error(json.message || json.wording || 'send_failed')
    }
    return json
  }

  async function approveDraft(id) {
    const draft = persist.getDraft(id)
    if (!draft || draft.status !== 'pending') throw new Error('draft_not_found')
    await napcatSend(draft.accountId, {
      type: draft.type,
      peerId: draft.peerId,
      message: draft.message || draft.text
    })
    persist.patchDraft(id, { status: 'sent', sentAt: Date.now() })
    persist.upsertSession({
      ...persist.getSession(draft.sessionKey),
      key: draft.sessionKey,
      status: 'replied',
      lastAt: Date.now(),
      lastText: draft.text
    })
    persist.updateMessages(draft.sessionKey, (messages) => {
      let found = false
      const next = messages.map((m) => {
        if (m.role === 'draft' && (m.draftId === id || m.id === id)) {
          found = true
          return { ...m, id: `sent-${id}`, role: 'bot', draftId: undefined }
        }
        return m
      })
      if (found) return next
      return [...next, { id: `sent-${id}`, role: 'bot', text: draft.text, at: Date.now() }]
    })
    emit()
    return persist.getDraft(id)
  }

  function discardDraft(id) {
    const draft = persist.getDraft(id)
    if (!draft || draft.status !== 'pending') throw new Error('draft_not_found')
    persist.patchDraft(id, { status: 'discarded', discardedAt: Date.now() })
    persist.upsertSession({
      ...persist.getSession(draft.sessionKey),
      key: draft.sessionKey,
      status: 'idle',
      lastAt: Date.now()
    })
    persist.updateMessages(draft.sessionKey, (messages) =>
      messages.filter((m) => !(m.role === 'draft' && (m.draftId === id || m.id === id)))
    )
    emit()
    return persist.getDraft(id)
  }

  async function sendToPeer(accountId, { type = 'private', peerId, text }) {
    if (!text) throw new Error('empty_text')
    const key = sessionKey(accountId, type, peerId)
    persist.upsertSession({
      key, accountId, type, peerId, lastText: text, lastAt: Date.now(), status: 'replied'
    })
    persist.appendMessage(key, { id: `op-send-${Date.now()}`, role: 'operator', text, at: Date.now() })
    await napcatSend(accountId, { type, peerId, message: text })
    emit()
    return { ok: true }
  }

  function liveAstrWs(instanceId) {
    const bridge = bridges.get(instanceId)
    if (bridge?.astrWs && bridge.astrWs.readyState === WebSocket.OPEN) return bridge
    return null
  }

  async function openAssistBridge(inst, accountId) {
    const existing = liveAstrWs(inst.id)
    if (existing) return existing
    if (!inst.uin) throw new Error('账号未在线')
    const reversePort = astrbotReversePort(inst.ports)
    const live = await astrbot.ensureAdapter({
      uin: inst.uin,
      reversePort,
      enable: true
    })
    const url = live?.url || `ws://127.0.0.1:${reversePort}/ws`
    const token = live?.token || ''
    const headers = {
      'X-Self-ID': String(inst.uin),
      'x-client-role': 'Universal',
      'User-Agent': 'OneBot/11'
    }
    if (token) headers.Authorization = `Bearer ${token}`
    log('agent', `assist ${inst.id} -> ${url}`)
    const astrWs = new WebSocket(url, { headers })
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('AstrBot 临时连接超时')), 15000)
      astrWs.once('open', () => {
        clearTimeout(timer)
        resolve()
      })
      astrWs.once('error', (e) => {
        clearTimeout(timer)
        reject(e)
      })
    })
    if (liveAstrWs(inst.id)) {
      try { astrWs.close() } catch { /* ignore */ }
      return liveAstrWs(inst.id)
    }
    bridges.set(inst.id, { napcatWs: null, astrWs, accountId, assistOnly: true })
    astrWs.on('message', (raw) => {
      const msg = parseJson(raw)
      if (msg?.action && !isSendAction(msg)) {
        const step = describeAction(msg)
        const key = sessionKeyFromAction(accountId, msg)
        if (step && key) {
          addThinkStep(key, step)
          emit()
        }
      }
      if (msg && isSendAction(msg)) {
        decideOutbound(accountId, msg)
        if (astrWs.readyState === WebSocket.OPEN) astrWs.send(fakeOk(msg.echo))
      }
    })
    astrWs.on('close', () => {
      const cur = bridges.get(inst.id)
      if (cur?.astrWs === astrWs) bridges.delete(inst.id)
    })
    astrWs.on('error', (e) => logError('agent', 'assist ws', e))
    return bridges.get(inst.id)
  }

  async function askBot(accountId, { type = 'private', peerId, text, quote }) {
    if (!text && !quote) throw new Error('empty_text')
    const inst = instForAccount(accountId)
    if (!inst) throw new Error('账号未在线')
    let bridge = liveAstrWs(inst.id)
    if (!bridge) bridge = await openAssistBridge(inst, accountId)
    if (!bridge?.astrWs || bridge.astrWs.readyState !== WebSocket.OPEN) {
      throw new Error('Bot 尚未连上 AstrBot')
    }
    const key = sessionKey(accountId, type, peerId)
    const quoted = quote ? `引用：\n> ${String(quote).replace(/\n/g, '\n> ')}\n` : ''
    const payload = `${OPERATOR_PREFIX}\n${quoted}${text || ''}`.trim()
    persist.upsertSession({
      key, accountId, type, peerId, lastAt: Date.now(), status: 'processing', assistHold: true
    })
    persist.appendMessage(key, {
      id: `ask-${Date.now()}`,
      role: 'operator',
      text: payload,
      at: Date.now()
    })
    startThinking(key, [
      { kind: 'recv', title: quote ? '引用对话并询问 Bot' : '收到你的补充指示', detail: clipText(text || quote), at: Date.now() },
      { kind: 'mode', title: '回复会出现在右侧，不会直接发给对方', at: Date.now() }
    ])
    const event = operatorOb11Event({
      type,
      peerId,
      selfId: inst.uin,
      payload
    })
    bridge.astrWs.send(JSON.stringify(event))
    emit()
    return { ok: true, key }
  }

  function attachBridge(instanceId, napcatWs, astrWs, accountId) {
    const prev = bridges.get(instanceId)
    if (prev?.astrWs && prev.astrWs !== astrWs) {
      try { prev.astrWs.close() } catch { /* ignore */ }
    }
    bridges.set(instanceId, { napcatWs, astrWs, accountId })

    napcatWs.on('message', (raw) => {
      const msg = parseJson(raw)
      if (msg?.post_type === 'message') ingestUser(accountId, msg)
      if (astrWs.readyState === WebSocket.OPEN) astrWs.send(raw)
    })
    astrWs.on('message', (raw) => {
      const msg = parseJson(raw)
      if (msg?.action && !isSendAction(msg)) {
        const step = describeAction(msg)
        const key = sessionKeyFromAction(accountId, msg)
        if (step && key) {
          addThinkStep(key, step)
          emit()
        }
      }
      if (msg && isSendAction(msg)) {
        const decision = decideOutbound(accountId, msg)
        if (decision.hold) {
          if (astrWs.readyState === WebSocket.OPEN) astrWs.send(fakeOk(msg.echo))
          return
        }
      }
      if (napcatWs.readyState === WebSocket.OPEN) napcatWs.send(raw)
    })
    const cleanup = () => {
      const cur = bridges.get(instanceId)
      if (cur?.napcatWs === napcatWs) bridges.delete(instanceId)
    }
    napcatWs.on('close', () => {
      try { astrWs.close() } catch { /* ignore */ }
      cleanup()
    })
    astrWs.on('close', cleanup)
    napcatWs.on('error', (e) => logError('agent', 'napcat ws', e))
    astrWs.on('error', (e) => logError('agent', 'astrbot ws', e))
  }

  function handleUpgrade(req, socket, head, instanceId) {
    const inst = qq.getInstanceProxy(instanceId)
    if (!inst?.id) {
      socket.destroy()
      return false
    }
    const acc = (accounts.list().accounts || []).find((a) => a.instanceId === inst.id)
    const uin = acc?.uin
    if (!uin) {
      socket.destroy()
      return false
    }
    const reversePort = inst.astrbotReverse || astrbotReversePort(inst)

    wss.handleUpgrade(req, socket, head, (napcatWs) => {
      Promise.resolve()
        .then(async () => {
          const live = await astrbot.reverseEndpoint(uin, reversePort)
          const url = live?.url || (reversePort ? `ws://127.0.0.1:${reversePort}/ws` : '')
          if (!url) throw new Error(`AstrBot 反向地址缺失 uin=${uin}`)
          const token = live?.token || ''
          const headers = {
            'X-Self-ID': String(req.headers['x-self-id'] || uin),
            'x-client-role': req.headers['x-client-role'] || 'Universal',
            'User-Agent': req.headers['user-agent'] || 'OneBot/11'
          }
          const auth = req.headers.authorization || (token ? `Bearer ${token}` : '')
          if (auth) headers.Authorization = auth
          log('agent', `bridge ${inst.id} -> ${url}`)
          const astrWs = new WebSocket(url, { headers })
          astrWs.on('open', () => attachBridge(inst.id, napcatWs, astrWs, acc?.id || `qq:${uin}`))
          astrWs.on('error', (e) => {
            logError('agent', 'upstream', e)
            try { napcatWs.close() } catch { /* ignore */ }
          })
        })
        .catch((e) => {
          logError('agent', 'upgrade', e)
          try { napcatWs.close() } catch { /* ignore */ }
        })
    })
    return true
  }

  async function handleHttp(req, res, url) {
    const method = req.method || 'GET'
    const p = url.pathname
    const accountId = url.searchParams.get('accountId') || ''

    const json = (obj, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(obj))
      return true
    }
    const readBody = () => new Promise((resolve) => {
      const chunks = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')) } catch { resolve({}) }
      })
    })

    if (p === '/api/runtime/agent/state' && method === 'GET') {
      return json(view(accountId || undefined))
    }
    if (p === '/api/runtime/agent/sessions' && method === 'GET') {
      return json({ sessions: view(accountId || undefined).sessions })
    }
    if (p === '/api/runtime/agent/session' && method === 'GET') {
      const key = url.searchParams.get('key')
        || sessionKey(accountId, url.searchParams.get('type') || 'private', url.searchParams.get('peerId'))
      const session = persist.getSession(key)
      if (!session) return json({ error: 'not_found' }, 404)
      const drafts = persist.listDrafts(session.accountId, 'pending').filter((d) => d.sessionKey === key)
      return json({ session: { ...session, mode: persist.sessionMode(session), drafts } })
    }
    if (p === '/api/runtime/agent/mode' && method === 'POST') {
      const body = await readBody()
      if (!MODES.includes(body.mode)) return json({ error: 'invalid_mode' }, 400)
      if (body.peerId) {
        const key = body.key || sessionKey(body.accountId, body.type || 'private', body.peerId)
        persist.setSessionMode(key, body.mode)
      } else if (body.accountId) {
        persist.setAccountMode(body.accountId, body.mode)
      } else {
        return json({ error: 'missing_account' }, 400)
      }
      emit()
      return json(view(body.accountId))
    }
    if (p === '/api/runtime/agent/draft/approve' && method === 'POST') {
      const body = await readBody()
      try {
        return json({ draft: await approveDraft(body.id) })
      } catch (e) {
        return json({ error: e.message }, 400)
      }
    }
    if (p === '/api/runtime/agent/draft/discard' && method === 'POST') {
      const body = await readBody()
      try {
        return json({ draft: discardDraft(body.id) })
      } catch (e) {
        return json({ error: e.message }, 400)
      }
    }
    if (p === '/api/runtime/agent/ask' && method === 'POST') {
      const body = await readBody()
      try {
        return json(await askBot(body.accountId, body))
      } catch (e) {
        return json({ error: e.message, message: e.message }, 400)
      }
    }
    if (p === '/api/runtime/agent/send' && method === 'POST') {
      const body = await readBody()
      try {
        return json(await sendToPeer(body.accountId, body))
      } catch (e) {
        return json({ error: e.message, message: e.message }, 400)
      }
    }
    if (p === '/api/runtime/agent/stream' && method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      })
      if (typeof res.flushHeaders === 'function') res.flushHeaders()
      const send = (snap) => {
        try { res.write(`data: ${JSON.stringify(snap)}\n\n`) } catch { /* closed */ }
      }
      send(view(accountId || undefined))
      const unsub = subscribe(() => send(view(accountId || undefined)))
      const beat = setInterval(() => {
        try { res.write(': ping\n\n') } catch { /* closed */ }
      }, 15000)
      const onClose = () => {
        unsub()
        clearInterval(beat)
      }
      req.on('close', onClose)
      res.on('close', onClose)
      return true
    }
    return false
  }

  return {
    handleHttp,
    handleUpgrade,
    subscribe,
    view,
    pendingCounts: () => persist.pendingCounts(),
    persist
  }
}

export { OPERATOR_PREFIX, MODES, ob11TextSegment, operatorOb11Event }
