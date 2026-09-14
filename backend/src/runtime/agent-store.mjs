import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

export const MODES = ['ask', 'auto', 'always']
const MAX_MESSAGES = 120

export function sessionKey(accountId, type, peerId) {
  return `${accountId}:${type || 'private'}:${peerId}`
}

export function createAgentStore(filePath) {
  function load() {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch {
      return { accountModes: {}, sessions: {}, drafts: {} }
    }
  }

  function save(data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  }

  function mutate(fn) {
    const data = load()
    const out = fn(data) || data
    save(out)
    return out
  }

  function accountMode(accountId) {
    const mode = load().accountModes?.[accountId]
    return MODES.includes(mode) ? mode : 'always'
  }

  function setAccountMode(accountId, mode) {
    if (!MODES.includes(mode)) throw new Error('invalid_mode')
    mutate((data) => {
      data.accountModes = data.accountModes || {}
      data.accountModes[accountId] = mode
    })
    return mode
  }

  function sessionMode(session) {
    if (session?.mode && MODES.includes(session.mode)) return session.mode
    return accountMode(session?.accountId)
  }

  function upsertSession(fields) {
    const key = fields.key || sessionKey(fields.accountId, fields.type, fields.peerId)
    let session = null
    mutate((data) => {
      data.sessions = data.sessions || {}
      const prev = data.sessions[key] || {
        key,
        accountId: fields.accountId,
        type: fields.type || 'private',
        peerId: String(fields.peerId),
        title: '',
        lastText: '',
        lastAt: 0,
        status: 'idle',
        mode: null,
        messages: [],
        assistHold: false
      }
      session = {
        ...prev,
        ...fields,
        key,
        peerId: String(fields.peerId || prev.peerId),
        messages: fields.messages || prev.messages || []
      }
      if (session.messages.length > MAX_MESSAGES) {
        session.messages = session.messages.slice(-MAX_MESSAGES)
      }
      data.sessions[key] = session
    })
    return session
  }

  function getSession(key) {
    return load().sessions?.[key] || null
  }

  function listSessions(accountId) {
    const all = Object.values(load().sessions || {})
    const list = accountId ? all.filter((s) => s.accountId === accountId) : all
    return list.sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0))
  }

  function appendMessage(key, msg) {
    let session = null
    mutate((data) => {
      const cur = data.sessions?.[key]
      if (!cur) return data
      const messages = [...(cur.messages || []), msg]
      session = {
        ...cur,
        messages: messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages,
        lastText: msg.role === 'thinking' ? cur.lastText : (msg.text || cur.lastText),
        lastAt: msg.at || Date.now()
      }
      data.sessions[key] = session
    })
    return session
  }

  function updateMessages(key, fn) {
    let session = null
    mutate((data) => {
      const cur = data.sessions?.[key]
      if (!cur) return data
      session = { ...cur, messages: fn([...(cur.messages || [])]) }
      data.sessions[key] = session
    })
    return session
  }

  function setSessionMode(key, mode) {
    if (!MODES.includes(mode)) throw new Error('invalid_mode')
    const cur = getSession(key)
    if (!cur) throw new Error('session_not_found')
    return upsertSession({ ...cur, key, mode })
  }

  function addDraft(draft) {
    const id = draft.id || `draft-${randomBytes(4).toString('hex')}`
    const next = {
      id,
      status: 'pending',
      createdAt: Date.now(),
      ...draft
    }
    mutate((data) => {
      data.drafts = data.drafts || {}
      data.drafts[id] = next
    })
    return next
  }

  function getDraft(id) {
    return load().drafts?.[id] || null
  }

  function listDrafts(accountId, status = 'pending') {
    return Object.values(load().drafts || {}).filter((d) => {
      if (status && d.status !== status) return false
      if (accountId && d.accountId !== accountId) return false
      return true
    }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }

  function patchDraft(id, fields) {
    let draft = null
    mutate((data) => {
      if (!data.drafts?.[id]) return data
      draft = { ...data.drafts[id], ...fields }
      data.drafts[id] = draft
    })
    return draft
  }

  function claimDraft(id) {
    let draft = null
    mutate((data) => {
      const current = data.drafts?.[id]
      if (!current || current.status !== 'pending') return data
      draft = { ...current, status: 'sending', claimedAt: Date.now() }
      data.drafts[id] = draft
    })
    return draft
  }

  function recoverSendingDrafts() {
    mutate((data) => {
      for (const [id, draft] of Object.entries(data.drafts || {})) {
        if (draft.status === 'sending') {
          data.drafts[id] = {
            ...draft,
            status: 'unknown',
            unknownAt: Date.now(),
            error: draft.error || 'delivery_interrupted',
          }
          if (draft.sessionKey && data.sessions?.[draft.sessionKey]) {
            data.sessions[draft.sessionKey] = { ...data.sessions[draft.sessionKey], status: 'delivery_unknown' }
          }
        }
      }
    })
  }

  function supersedePendingDrafts(key, reason = 'conversation_changed') {
    mutate((data) => {
      for (const [id, draft] of Object.entries(data.drafts || {})) {
        if (draft.sessionKey === key && draft.status === 'pending') {
          data.drafts[id] = { ...draft, status: 'superseded', supersededAt: Date.now(), reason }
        }
      }
    })
  }

  function pendingCounts() {
    const counts = {}
    for (const d of Object.values(load().drafts || {})) {
      if (d.status !== 'pending') continue
      counts[d.accountId] = (counts[d.accountId] || 0) + 1
    }
    return counts
  }

  return {
    load,
    accountMode,
    setAccountMode,
    sessionMode,
    upsertSession,
    getSession,
    listSessions,
    appendMessage,
    updateMessages,
    setSessionMode,
    addDraft,
    getDraft,
    listDrafts,
    patchDraft,
    claimDraft,
    recoverSendingDrafts,
    supersedePendingDrafts,
    pendingCounts,
    sessionKey
  }
}
