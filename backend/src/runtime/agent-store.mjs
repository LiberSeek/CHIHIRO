import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { createSqliteAgentStore, sqliteAvailable } from './agent-store-sqlite.mjs'

export const MODES = ['ask', 'auto', 'always']
export const OUTBOX_STATES = ['queued', 'sending', 'sent', 'failed', 'unknown', 'canceled']
export const DELIVERY_ATTEMPT_STATES = ['sending', 'sent', 'failed', 'unknown']
const MAX_MESSAGES = 120

export function sessionKey(accountId, type, peerId) {
  return `${accountId}:${type || 'private'}:${peerId}`
}

export function createAgentStore(filePath) {
  if (sqliteAvailable && process.env.CHIHIRO_AGENT_STORE !== 'json') {
    return createSqliteAgentStore(filePath)
  }
  function load() {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch {
      return { accountModes: {}, sessions: {}, drafts: {}, outbox: {}, deliveryAttempts: {} }
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

  function enqueueDraft(id) {
    let outbox = null
    mutate((data) => {
      const draft = data.drafts?.[id]
      if (!draft || draft.status !== 'pending') return data
      data.outbox = data.outbox || {}
      const queuedAt = Date.now()
      const sequence = Object.values(data.outbox).reduce((max, item) => (
        item.sessionKey === draft.sessionKey ? Math.max(max, item.sequence || 0) : max
      ), 0) + 1
      const outboxId = `outbox-${id}`
      outbox = {
        id: outboxId,
        draftId: id,
        accountId: draft.accountId,
        sessionKey: draft.sessionKey,
        type: draft.type,
        peerId: draft.peerId,
        message: draft.message || draft.text,
        status: 'queued',
        sequence,
        queuedAt,
        updatedAt: queuedAt,
      }
      data.outbox[outboxId] = outbox
      data.drafts[id] = { ...draft, status: 'queued', outboxId, queuedAt }
    })
    return outbox
  }

  function getOutbox(id) {
    return load().outbox?.[id] || null
  }

  function getOutboxForDraft(draftId) {
    const data = load()
    const draft = data.drafts?.[draftId]
    if (draft?.outboxId && data.outbox?.[draft.outboxId]) return data.outbox[draft.outboxId]
    return Object.values(data.outbox || {})
      .filter((item) => item.draftId === draftId)
      .sort((a, b) => (b.updatedAt || b.queuedAt || 0) - (a.updatedAt || a.queuedAt || 0))[0] || null
  }

  function listOutbox(sessionKeyValue = null, status = null) {
    return Object.values(load().outbox || {}).filter((item) => {
      if (sessionKeyValue && item.sessionKey !== sessionKeyValue) return false
      if (status && item.status !== status) return false
      return true
    }).sort((a, b) => (a.sequence || 0) - (b.sequence || 0) || (a.queuedAt || 0) - (b.queuedAt || 0))
  }

  function listDeliveryAttempts(outboxId = null) {
    return Object.values(load().deliveryAttempts || {}).filter((attempt) => (
      !outboxId || attempt.outboxId === outboxId
    )).sort((a, b) => (a.number || 0) - (b.number || 0) || (a.startedAt || 0) - (b.startedAt || 0))
  }

  function claimNextOutbox(sessionKeyValue) {
    let claimed = null
    mutate((data) => {
      data.outbox = data.outbox || {}
      data.deliveryAttempts = data.deliveryAttempts || {}
      const items = Object.values(data.outbox).filter((item) => item.sessionKey === sessionKeyValue)
      if (items.some((item) => item.status === 'sending')) return data
      const outbox = items.filter((item) => item.status === 'queued').sort((a, b) => (
        (a.sequence || 0) - (b.sequence || 0) || (a.queuedAt || 0) - (b.queuedAt || 0)
      ))[0]
      const blocked = items.some((item) => item.status === 'unknown' && !item.supersededBy)
      if (blocked && !outbox?.retryOf) return data
      if (!outbox) return data
      const startedAt = Date.now()
      const number = Object.values(data.deliveryAttempts).filter((attempt) => attempt.outboxId === outbox.id).length + 1
      const attemptId = `attempt-${randomBytes(8).toString('hex')}`
      const attempt = {
        id: attemptId,
        outboxId: outbox.id,
        draftId: outbox.draftId,
        sessionKey: outbox.sessionKey,
        number,
        status: 'sending',
        startedAt,
      }
      const sending = { ...outbox, status: 'sending', attemptId, updatedAt: startedAt }
      data.outbox[outbox.id] = sending
      data.deliveryAttempts[attemptId] = attempt
      const draft = data.drafts?.[outbox.draftId]
      if (draft) data.drafts[outbox.draftId] = { ...draft, status: 'sending', attemptId, claimedAt: startedAt }
      claimed = { outbox: sending, attempt }
    })
    return claimed
  }

  function finishDelivery(outboxId, attemptId, status, fields = {}) {
    if (!['sent', 'failed', 'unknown'].includes(status)) throw new Error('invalid_delivery_status')
    let result = null
    mutate((data) => {
      const outbox = data.outbox?.[outboxId]
      const attempt = data.deliveryAttempts?.[attemptId]
      if (!outbox || outbox.status !== 'sending' || !attempt || attempt.status !== 'sending') return data
      const completedAt = Date.now()
      const timestamp = { [`${status}At`]: completedAt }
      const nextOutbox = { ...outbox, ...fields, ...timestamp, status, updatedAt: completedAt }
      const nextAttempt = { ...attempt, ...fields, ...timestamp, status, completedAt }
      data.outbox[outboxId] = nextOutbox
      data.deliveryAttempts[attemptId] = nextAttempt
      const draft = data.drafts?.[outbox.draftId]
      const nextDraft = draft ? { ...draft, ...fields, ...timestamp, status, attemptId } : null
      if (nextDraft) data.drafts[outbox.draftId] = nextDraft
      result = { outbox: nextOutbox, attempt: nextAttempt, draft: nextDraft }
    })
    return result
  }

  function retryDraft(id) {
    let result = null
    mutate((data) => {
      data.outbox = data.outbox || {}
      const draft = data.drafts?.[id]
      if (!draft) return data
      if ((draft.status === 'queued' || draft.status === 'sending') && draft.retryCount) {
        result = { draft, outbox: data.outbox[draft.outboxId] || null, existing: true }
        return data
      }
      if (!['unknown', 'failed'].includes(draft.status)) return data
      const previous = draft.outboxId ? data.outbox[draft.outboxId] : Object.values(data.outbox)
        .filter((item) => item.draftId === id)
        .sort((a, b) => (b.updatedAt || b.queuedAt || 0) - (a.updatedAt || a.queuedAt || 0))[0]
      const queuedAt = Date.now()
      const nextSequence = Object.values(data.outbox).reduce((max, item) => (
        item.sessionKey === draft.sessionKey ? Math.max(max, item.sequence || 0) : max
      ), 0) + 1
      const outboxId = `outbox-${id}-retry-${randomBytes(6).toString('hex')}`
      const outbox = {
        id: outboxId,
        draftId: id,
        accountId: draft.accountId,
        sessionKey: draft.sessionKey,
        type: draft.type,
        peerId: draft.peerId,
        message: draft.message || draft.text,
        status: 'queued',
        sequence: previous?.sequence || nextSequence,
        queuedAt,
        updatedAt: queuedAt,
        retryOf: previous?.id || null,
      }
      if (previous && ['unknown', 'failed'].includes(previous.status)) {
        data.outbox[previous.id] = { ...previous, supersededBy: outboxId, updatedAt: queuedAt }
      }
      const nextDraft = {
        ...draft,
        status: 'queued',
        outboxId,
        queuedAt,
        retryRequestedAt: queuedAt,
        retryCount: (draft.retryCount || 0) + 1,
        retryOf: previous?.id || null,
      }
      data.outbox[outboxId] = outbox
      data.drafts[id] = nextDraft
      result = { draft: nextDraft, outbox }
    })
    return result
  }

  function reconcileDraft(id, resolution = 'sent') {
    if (resolution !== 'sent') throw new Error('invalid_reconciliation')
    let result = null
    mutate((data) => {
      const draft = data.drafts?.[id]
      if (!draft) return data
      if (draft.status === 'sent' && draft.reconciliation?.resolution === 'sent') {
        result = { draft, outbox: draft.outboxId ? data.outbox?.[draft.outboxId] || null : null, existing: true }
        return data
      }
      if (draft.status !== 'unknown') return data
      const reconciledAt = Date.now()
      const reconciliation = { resolution: 'sent', reconciledAt, source: 'operator' }
      const outbox = draft.outboxId ? data.outbox?.[draft.outboxId] : null
      if (outbox?.status === 'unknown') {
        data.outbox[outbox.id] = {
          ...outbox,
          status: 'sent',
          sentAt: reconciledAt,
          reconciledAt,
          reconciliation,
          updatedAt: reconciledAt,
        }
        for (const [attemptId, attempt] of Object.entries(data.deliveryAttempts || {})) {
          if (attempt.outboxId === outbox.id) {
            data.deliveryAttempts[attemptId] = { ...attempt, reconciliation, reconciledAt }
          }
        }
      }
      const nextDraft = { ...draft, status: 'sent', sentAt: reconciledAt, reconciledAt, reconciliation }
      data.drafts[id] = nextDraft
      result = { draft: nextDraft, outbox: outbox ? data.outbox[outbox.id] : null }
    })
    return result
  }

  function recoverSendingDrafts() {
    mutate((data) => {
      const recoveredAt = Date.now()
      for (const [id, outbox] of Object.entries(data.outbox || {})) {
        if (outbox.status !== 'sending') continue
        data.outbox[id] = {
          ...outbox,
          status: 'unknown',
          unknownAt: recoveredAt,
          updatedAt: recoveredAt,
          error: outbox.error || 'delivery_interrupted',
        }
        for (const [attemptId, attempt] of Object.entries(data.deliveryAttempts || {})) {
          if (attempt.outboxId === id && attempt.status === 'sending') {
            data.deliveryAttempts[attemptId] = {
              ...attempt,
              status: 'unknown',
              unknownAt: recoveredAt,
              completedAt: recoveredAt,
              error: attempt.error || 'delivery_interrupted',
            }
          }
        }
      }
      for (const [id, draft] of Object.entries(data.drafts || {})) {
        if (draft.status === 'sending') {
          data.drafts[id] = {
            ...draft,
            status: 'unknown',
            unknownAt: recoveredAt,
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
        } else if (draft.sessionKey === key && draft.status === 'queued') {
          const canceledAt = Date.now()
          data.drafts[id] = { ...draft, status: 'canceled', canceledAt, reason }
          const outbox = data.outbox?.[draft.outboxId]
          if (outbox?.status === 'queued') {
            data.outbox[draft.outboxId] = { ...outbox, status: 'canceled', canceledAt, updatedAt: canceledAt, reason }
          }
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
    enqueueDraft,
    getOutbox,
    getOutboxForDraft,
    listOutbox,
    listDeliveryAttempts,
    claimNextOutbox,
    finishDelivery,
    retryDraft,
    reconcileDraft,
    recoverSendingDrafts,
    supersedePendingDrafts,
    pendingCounts,
    sessionKey
  }
}
