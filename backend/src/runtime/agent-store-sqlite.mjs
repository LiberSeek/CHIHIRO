import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

let DatabaseSync
try {
  ({ DatabaseSync } = await import('node:sqlite'))
} catch {
  DatabaseSync = null
}

export const sqliteAvailable = Boolean(DatabaseSync)
const MAX_MESSAGES = 120
const MODES = ['ask', 'auto', 'always']

function dbPathFor(filePath) {
  return filePath.endsWith('.json') ? `${filePath.slice(0, -5)}.sqlite` : `${filePath}.sqlite`
}

function readLegacy(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return { accountModes: {}, sessions: {}, drafts: {}, outbox: {}, deliveryAttempts: {} }
  }
}

export function createSqliteAgentStore(filePath) {
  if (!DatabaseSync) throw new Error('sqlite_unavailable')
  const dbPath = dbPathFor(filePath)
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS agent_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS agent_sessions (key TEXT PRIMARY KEY, account_id TEXT NOT NULL, last_at INTEGER NOT NULL DEFAULT 0, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS agent_drafts (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, session_key TEXT, status TEXT NOT NULL, created_at INTEGER NOT NULL, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS agent_outbox (id TEXT PRIMARY KEY, draft_id TEXT NOT NULL, account_id TEXT NOT NULL, session_key TEXT NOT NULL, status TEXT NOT NULL, sequence INTEGER NOT NULL, queued_at INTEGER NOT NULL, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS agent_delivery_attempts (id TEXT PRIMARY KEY, outbox_id TEXT NOT NULL, draft_id TEXT NOT NULL, session_key TEXT NOT NULL, number INTEGER NOT NULL, status TEXT NOT NULL, started_at INTEGER NOT NULL, completed_at INTEGER, value TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_agent_sessions_account ON agent_sessions(account_id, last_at DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_drafts_account_status ON agent_drafts(account_id, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_drafts_session_status ON agent_drafts(session_key, status);
    CREATE INDEX IF NOT EXISTS idx_agent_outbox_session_status_sequence ON agent_outbox(session_key, status, sequence);
    DROP INDEX IF EXISTS idx_agent_outbox_draft;
    CREATE INDEX IF NOT EXISTS idx_agent_outbox_draft ON agent_outbox(draft_id);
    CREATE INDEX IF NOT EXISTS idx_agent_attempts_outbox_number ON agent_delivery_attempts(outbox_id, number);
    CREATE INDEX IF NOT EXISTS idx_agent_attempts_session_status ON agent_delivery_attempts(session_key, status);
  `)

  if (!db.prepare('SELECT value FROM agent_meta WHERE key = ?').get('json_imported')) {
    const legacy = readLegacy(filePath)
    transaction(db, () => {
      const meta = db.prepare('INSERT OR REPLACE INTO agent_meta(key, value) VALUES (?, ?)')
      const session = db.prepare('INSERT OR REPLACE INTO agent_sessions(key, account_id, last_at, value) VALUES (?, ?, ?, ?)')
      const draft = db.prepare('INSERT OR REPLACE INTO agent_drafts(id, account_id, session_key, status, created_at, value) VALUES (?, ?, ?, ?, ?, ?)')
      const outbox = db.prepare('INSERT OR REPLACE INTO agent_outbox(id, draft_id, account_id, session_key, status, sequence, queued_at, value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      const attempt = db.prepare('INSERT OR REPLACE INTO agent_delivery_attempts(id, outbox_id, draft_id, session_key, number, status, started_at, completed_at, value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      for (const [accountId, mode] of Object.entries(legacy.accountModes || {})) meta.run(`accountMode:${accountId}`, String(mode))
      for (const [key, value] of Object.entries(legacy.sessions || {})) session.run(key, value.accountId || '', value.lastAt || 0, JSON.stringify(value))
      for (const [id, value] of Object.entries(legacy.drafts || {})) draft.run(id, value.accountId || '', value.sessionKey || null, value.status || 'pending', value.createdAt || 0, JSON.stringify(value))
      for (const [id, value] of Object.entries(legacy.outbox || {})) outbox.run(id, value.draftId || '', value.accountId || '', value.sessionKey || '', value.status || 'queued', value.sequence || 0, value.queuedAt || 0, JSON.stringify(value))
      for (const [id, value] of Object.entries(legacy.deliveryAttempts || {})) attempt.run(id, value.outboxId || '', value.draftId || '', value.sessionKey || '', value.number || 0, value.status || 'sending', value.startedAt || 0, value.completedAt || null, JSON.stringify(value))
      meta.run('json_imported', '1')
    })
  }

  const readAll = () => {
    const accountModes = {}
    for (const row of db.prepare("SELECT key, value FROM agent_meta WHERE key LIKE 'accountMode:%'").all()) accountModes[row.key.slice(12)] = row.value
    const sessions = Object.fromEntries(db.prepare('SELECT key, value FROM agent_sessions').all().map((row) => [row.key, JSON.parse(row.value)]))
    const drafts = Object.fromEntries(db.prepare('SELECT id, value FROM agent_drafts').all().map((row) => [row.id, JSON.parse(row.value)]))
    const outbox = Object.fromEntries(db.prepare('SELECT id, value FROM agent_outbox').all().map((row) => [row.id, JSON.parse(row.value)]))
    const deliveryAttempts = Object.fromEntries(db.prepare('SELECT id, value FROM agent_delivery_attempts').all().map((row) => [row.id, JSON.parse(row.value)]))
    return { accountModes, sessions, drafts, outbox, deliveryAttempts }
  }
  const getSession = (key) => {
    const row = db.prepare('SELECT value FROM agent_sessions WHERE key = ?').get(key)
    return row ? JSON.parse(row.value) : null
  }
  const getDraft = (id) => {
    const row = db.prepare('SELECT value FROM agent_drafts WHERE id = ?').get(id)
    return row ? JSON.parse(row.value) : null
  }
  const listSessions = (accountId) => {
    const rows = accountId
      ? db.prepare('SELECT value FROM agent_sessions WHERE account_id = ? ORDER BY last_at DESC').all(accountId)
      : db.prepare('SELECT value FROM agent_sessions ORDER BY last_at DESC').all()
    return rows.map((row) => JSON.parse(row.value))
  }
  const listDrafts = (accountId, status = 'pending') => {
    let rows
    if (accountId && status) rows = db.prepare('SELECT value FROM agent_drafts WHERE account_id = ? AND status = ? ORDER BY created_at DESC').all(accountId, status)
    else if (accountId) rows = db.prepare('SELECT value FROM agent_drafts WHERE account_id = ? ORDER BY created_at DESC').all(accountId)
    else if (status) rows = db.prepare('SELECT value FROM agent_drafts WHERE status = ? ORDER BY created_at DESC').all(status)
    else rows = db.prepare('SELECT value FROM agent_drafts ORDER BY created_at DESC').all()
    return rows.map((row) => JSON.parse(row.value))
  }
  const mutate = (fn) => transaction(db, () => {
    const data = readAll()
    const out = fn(data) || data
    const meta = db.prepare('INSERT OR REPLACE INTO agent_meta(key, value) VALUES (?, ?)')
    const session = db.prepare('INSERT OR REPLACE INTO agent_sessions(key, account_id, last_at, value) VALUES (?, ?, ?, ?)')
    const draft = db.prepare('INSERT OR REPLACE INTO agent_drafts(id, account_id, session_key, status, created_at, value) VALUES (?, ?, ?, ?, ?, ?)')
    const outbox = db.prepare('INSERT OR REPLACE INTO agent_outbox(id, draft_id, account_id, session_key, status, sequence, queued_at, value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    const attempt = db.prepare('INSERT OR REPLACE INTO agent_delivery_attempts(id, outbox_id, draft_id, session_key, number, status, started_at, completed_at, value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    for (const [accountId, mode] of Object.entries(out.accountModes || {})) meta.run(`accountMode:${accountId}`, String(mode))
    for (const [key, value] of Object.entries(out.sessions || {})) session.run(key, value.accountId || '', value.lastAt || 0, JSON.stringify(value))
    for (const [id, value] of Object.entries(out.drafts || {})) draft.run(id, value.accountId || '', value.sessionKey || null, value.status || 'pending', value.createdAt || 0, JSON.stringify(value))
    for (const [id, value] of Object.entries(out.outbox || {})) outbox.run(id, value.draftId || '', value.accountId || '', value.sessionKey || '', value.status || 'queued', value.sequence || 0, value.queuedAt || 0, JSON.stringify(value))
    for (const [id, value] of Object.entries(out.deliveryAttempts || {})) attempt.run(id, value.outboxId || '', value.draftId || '', value.sessionKey || '', value.number || 0, value.status || 'sending', value.startedAt || 0, value.completedAt || null, JSON.stringify(value))
    return out
  })
  function accountMode(accountId) {
    const mode = readAll().accountModes?.[accountId]
    return MODES.includes(mode) ? mode : 'always'
  }
  function setAccountMode(accountId, mode) {
    if (!MODES.includes(mode)) throw new Error('invalid_mode')
    mutate((data) => { data.accountModes[accountId] = mode })
    return mode
  }
  function sessionMode(session) { return session?.mode && MODES.includes(session.mode) ? session.mode : accountMode(session?.accountId) }
  function upsertSession(fields) {
    const key = fields.key || `${fields.accountId}:${fields.type || 'private'}:${fields.peerId}`
    let session
    mutate((data) => {
      const prev = data.sessions[key] || { key, accountId: fields.accountId, type: fields.type || 'private', peerId: String(fields.peerId), title: '', lastText: '', lastAt: 0, status: 'idle', mode: null, messages: [], assistHold: false }
      session = { ...prev, ...fields, key, peerId: String(fields.peerId || prev.peerId), messages: fields.messages || prev.messages || [] }
      if (session.messages.length > MAX_MESSAGES) session.messages = session.messages.slice(-MAX_MESSAGES)
      data.sessions[key] = session
    })
    return session
  }
  function appendMessage(key, msg) {
    let session
    mutate((data) => {
      const current = data.sessions[key]
      if (!current) return data
      const messages = [...(current.messages || []), msg]
      session = { ...current, messages: messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages, lastText: msg.role === 'thinking' ? current.lastText : (msg.text || current.lastText), lastAt: msg.at || Date.now() }
      data.sessions[key] = session
    })
    return session
  }
  function updateMessages(key, fn) {
    let session
    mutate((data) => {
      const current = data.sessions[key]
      if (!current) return data
      session = { ...current, messages: fn([...(current.messages || [])]) }
      data.sessions[key] = session
    })
    return session
  }
  function setSessionMode(key, mode) {
    if (!MODES.includes(mode)) throw new Error('invalid_mode')
    const current = getSession(key)
    if (!current) throw new Error('session_not_found')
    return upsertSession({ ...current, key, mode })
  }
  function addDraft(fields) {
    const id = fields.id || `draft-${randomBytes(4).toString('hex')}`
    const draft = { id, status: 'pending', createdAt: Date.now(), ...fields }
    mutate((data) => { data.drafts[id] = draft })
    return draft
  }
  function patchDraft(id, fields) {
    let draft
    mutate((data) => { if (data.drafts[id]) { draft = { ...data.drafts[id], ...fields }; data.drafts[id] = draft } })
    return draft
  }
  function claimDraft(id) {
    return transaction(db, () => {
      const current = getDraft(id)
      if (!current || current.status !== 'pending') return null
      const draft = { ...current, status: 'sending', claimedAt: Date.now() }
      const result = db.prepare('UPDATE agent_drafts SET status = ?, value = ? WHERE id = ? AND status = ?').run('sending', JSON.stringify(draft), id, 'pending')
      return result.changes === 1 ? draft : null
    })
  }

  function enqueueDraft(id) {
    let outbox = null
    mutate((data) => {
      const draft = data.drafts[id]
      if (!draft || draft.status !== 'pending') return data
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
    const row = db.prepare('SELECT value FROM agent_outbox WHERE id = ?').get(id)
    return row ? JSON.parse(row.value) : null
  }

  function getOutboxForDraft(draftId) {
    const draft = getDraft(draftId)
    const row = draft?.outboxId
      ? db.prepare('SELECT value FROM agent_outbox WHERE id = ?').get(draft.outboxId)
      : db.prepare('SELECT value FROM agent_outbox WHERE draft_id = ? ORDER BY queued_at DESC LIMIT 1').get(draftId)
    return row ? JSON.parse(row.value) : null
  }

  function listOutbox(sessionKeyValue = null, status = null) {
    let rows
    if (sessionKeyValue && status) rows = db.prepare('SELECT value FROM agent_outbox WHERE session_key = ? AND status = ? ORDER BY sequence, queued_at').all(sessionKeyValue, status)
    else if (sessionKeyValue) rows = db.prepare('SELECT value FROM agent_outbox WHERE session_key = ? ORDER BY sequence, queued_at').all(sessionKeyValue)
    else if (status) rows = db.prepare('SELECT value FROM agent_outbox WHERE status = ? ORDER BY session_key, sequence, queued_at').all(status)
    else rows = db.prepare('SELECT value FROM agent_outbox ORDER BY session_key, sequence, queued_at').all()
    return rows.map((row) => JSON.parse(row.value))
  }

  function listDeliveryAttempts(outboxId = null) {
    const rows = outboxId
      ? db.prepare('SELECT value FROM agent_delivery_attempts WHERE outbox_id = ? ORDER BY number, started_at').all(outboxId)
      : db.prepare('SELECT value FROM agent_delivery_attempts ORDER BY session_key, started_at, number').all()
    return rows.map((row) => JSON.parse(row.value))
  }

  function claimNextOutbox(sessionKeyValue) {
    let claimed = null
    mutate((data) => {
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
      const draft = data.drafts[outbox.draftId]
      if (draft) data.drafts[outbox.draftId] = { ...draft, status: 'sending', attemptId, claimedAt: startedAt }
      claimed = { outbox: sending, attempt }
    })
    return claimed
  }

  function finishDelivery(outboxId, attemptId, status, fields = {}) {
    if (!['sent', 'failed', 'unknown'].includes(status)) throw new Error('invalid_delivery_status')
    let result = null
    mutate((data) => {
      const outbox = data.outbox[outboxId]
      const attempt = data.deliveryAttempts[attemptId]
      if (!outbox || outbox.status !== 'sending' || !attempt || attempt.status !== 'sending') return data
      const completedAt = Date.now()
      const timestamp = { [`${status}At`]: completedAt }
      const nextOutbox = { ...outbox, ...fields, ...timestamp, status, updatedAt: completedAt }
      const nextAttempt = { ...attempt, ...fields, ...timestamp, status, completedAt }
      data.outbox[outboxId] = nextOutbox
      data.deliveryAttempts[attemptId] = nextAttempt
      const draft = data.drafts[outbox.draftId]
      const nextDraft = draft ? { ...draft, ...fields, ...timestamp, status, attemptId } : null
      if (nextDraft) data.drafts[outbox.draftId] = nextDraft
      result = { outbox: nextOutbox, attempt: nextAttempt, draft: nextDraft }
    })
    return result
  }

  function retryDraft(id) {
    let result = null
    mutate((data) => {
      const draft = data.drafts[id]
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
      const draft = data.drafts[id]
      if (!draft) return data
      if (draft.status === 'sent' && draft.reconciliation?.resolution === 'sent') {
        result = { draft, outbox: draft.outboxId ? data.outbox[draft.outboxId] || null : null, existing: true }
        return data
      }
      if (draft.status !== 'unknown') return data
      const reconciledAt = Date.now()
      const reconciliation = { resolution: 'sent', reconciledAt, source: 'operator' }
      const outbox = draft.outboxId ? data.outbox[draft.outboxId] : null
      if (outbox?.status === 'unknown') {
        data.outbox[outbox.id] = {
          ...outbox,
          status: 'sent',
          sentAt: reconciledAt,
          reconciledAt,
          reconciliation,
          updatedAt: reconciledAt,
        }
        for (const [attemptId, attempt] of Object.entries(data.deliveryAttempts)) {
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
      for (const [id, outbox] of Object.entries(data.outbox)) {
        if (outbox.status !== 'sending') continue
        data.outbox[id] = {
          ...outbox,
          status: 'unknown',
          unknownAt: recoveredAt,
          updatedAt: recoveredAt,
          error: outbox.error || 'delivery_interrupted',
        }
        for (const [attemptId, attempt] of Object.entries(data.deliveryAttempts)) {
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
      for (const [id, draft] of Object.entries(data.drafts)) {
        if (draft.status !== 'sending') continue
        data.drafts[id] = {
          ...draft,
          status: 'unknown',
          unknownAt: recoveredAt,
          error: draft.error || 'delivery_interrupted',
        }
        if (draft.sessionKey && data.sessions[draft.sessionKey]) {
          data.sessions[draft.sessionKey] = { ...data.sessions[draft.sessionKey], status: 'delivery_unknown' }
        }
      }
    })
  }
  function supersedePendingDrafts(key, reason = 'conversation_changed') {
    mutate((data) => {
      for (const [id, draft] of Object.entries(data.drafts)) {
        if (draft.sessionKey === key && draft.status === 'pending') {
          data.drafts[id] = { ...draft, status: 'superseded', supersededAt: Date.now(), reason }
        } else if (draft.sessionKey === key && draft.status === 'queued') {
          const canceledAt = Date.now()
          data.drafts[id] = { ...draft, status: 'canceled', canceledAt, reason }
          const outbox = data.outbox[draft.outboxId]
          if (outbox?.status === 'queued') {
            data.outbox[draft.outboxId] = { ...outbox, status: 'canceled', canceledAt, updatedAt: canceledAt, reason }
          }
        }
      }
    })
  }
  function pendingCounts() {
    const counts = {}
    for (const draft of listDrafts(null, null)) if (draft.status === 'pending') counts[draft.accountId] = (counts[draft.accountId] || 0) + 1
    return counts
  }
  return { load: readAll, accountMode, setAccountMode, sessionMode, upsertSession, getSession, listSessions, appendMessage, updateMessages, setSessionMode, addDraft, getDraft, listDrafts, patchDraft, claimDraft, enqueueDraft, getOutbox, getOutboxForDraft, listOutbox, listDeliveryAttempts, claimNextOutbox, finishDelivery, retryDraft, reconcileDraft, recoverSendingDrafts, supersedePendingDrafts, pendingCounts, sessionKey: (accountId, type, peerId) => `${accountId}:${type || 'private'}:${peerId}` }
}

function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
