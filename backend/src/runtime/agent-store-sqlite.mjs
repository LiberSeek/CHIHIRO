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
    return { accountModes: {}, sessions: {}, drafts: {} }
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
    CREATE INDEX IF NOT EXISTS idx_agent_sessions_account ON agent_sessions(account_id, last_at DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_drafts_account_status ON agent_drafts(account_id, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_drafts_session_status ON agent_drafts(session_key, status);
  `)

  if (!db.prepare('SELECT value FROM agent_meta WHERE key = ?').get('json_imported')) {
    const legacy = readLegacy(filePath)
    transaction(db, () => {
      const meta = db.prepare('INSERT OR REPLACE INTO agent_meta(key, value) VALUES (?, ?)')
      const session = db.prepare('INSERT OR REPLACE INTO agent_sessions(key, account_id, last_at, value) VALUES (?, ?, ?, ?)')
      const draft = db.prepare('INSERT OR REPLACE INTO agent_drafts(id, account_id, session_key, status, created_at, value) VALUES (?, ?, ?, ?, ?, ?)')
      for (const [accountId, mode] of Object.entries(legacy.accountModes || {})) meta.run(`accountMode:${accountId}`, String(mode))
      for (const [key, value] of Object.entries(legacy.sessions || {})) session.run(key, value.accountId || '', value.lastAt || 0, JSON.stringify(value))
      for (const [id, value] of Object.entries(legacy.drafts || {})) draft.run(id, value.accountId || '', value.sessionKey || null, value.status || 'pending', value.createdAt || 0, JSON.stringify(value))
      meta.run('json_imported', '1')
    })
  }

  const readAll = () => {
    const accountModes = {}
    for (const row of db.prepare("SELECT key, value FROM agent_meta WHERE key LIKE 'accountMode:%'").all()) accountModes[row.key.slice(12)] = row.value
    const sessions = Object.fromEntries(db.prepare('SELECT key, value FROM agent_sessions').all().map((row) => [row.key, JSON.parse(row.value)]))
    const drafts = Object.fromEntries(db.prepare('SELECT id, value FROM agent_drafts').all().map((row) => [row.id, JSON.parse(row.value)]))
    return { accountModes, sessions, drafts }
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
    for (const [accountId, mode] of Object.entries(out.accountModes || {})) meta.run(`accountMode:${accountId}`, String(mode))
    for (const [key, value] of Object.entries(out.sessions || {})) session.run(key, value.accountId || '', value.lastAt || 0, JSON.stringify(value))
    for (const [id, value] of Object.entries(out.drafts || {})) draft.run(id, value.accountId || '', value.sessionKey || null, value.status || 'pending', value.createdAt || 0, JSON.stringify(value))
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
  function recoverSendingDrafts() {
    mutate((data) => { for (const [id, draft] of Object.entries(data.drafts)) if (draft.status === 'sending') { data.drafts[id] = { ...draft, status: 'unknown', unknownAt: Date.now(), error: draft.error || 'delivery_interrupted' }; if (draft.sessionKey && data.sessions[draft.sessionKey]) data.sessions[draft.sessionKey] = { ...data.sessions[draft.sessionKey], status: 'delivery_unknown' } } })
  }
  function supersedePendingDrafts(key, reason = 'conversation_changed') {
    mutate((data) => { for (const [id, draft] of Object.entries(data.drafts)) if (draft.sessionKey === key && draft.status === 'pending') data.drafts[id] = { ...draft, status: 'superseded', supersededAt: Date.now(), reason } })
  }
  function pendingCounts() {
    const counts = {}
    for (const draft of listDrafts(null, null)) if (draft.status === 'pending') counts[draft.accountId] = (counts[draft.accountId] || 0) + 1
    return counts
  }
  return { load: readAll, accountMode, setAccountMode, sessionMode, upsertSession, getSession, listSessions, appendMessage, updateMessages, setSessionMode, addDraft, getDraft, listDrafts, patchDraft, claimDraft, recoverSendingDrafts, supersedePendingDrafts, pendingCounts, sessionKey: (accountId, type, peerId) => `${accountId}:${type || 'private'}:${peerId}` }
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
