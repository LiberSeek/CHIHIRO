import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

let DatabaseSync
try {
  ({ DatabaseSync } = await import('node:sqlite'))
} catch {
  DatabaseSync = null
}

export const customerInsightsSqliteAvailable = Boolean(DatabaseSync)

const ID_PART_SEPARATOR = '\u001f'
const FACT_KINDS = new Set([
  'name',
  'company',
  'role',
  'phone',
  'email',
  'wechat',
  'location',
  'budget',
  'need',
  'preference',
  'objection',
  'note'
])
const INTENT_KINDS = new Set([
  'purchase',
  'trial',
  'pricing',
  'renewal',
  'support',
  'complaint',
  'follow_up',
  'meeting',
  'churn_risk',
  'custom'
])
const INTENT_STATUSES = new Set(['open', 'won', 'lost', 'paused', 'dismissed'])

export const CUSTOMER_INSIGHTS_SCHEMAS = Object.freeze({
  customerKey: ['accountId', 'channel', 'peerId'],
  source: ['conversationId', 'messageId'],
  factKinds: Array.from(FACT_KINDS),
  intentKinds: Array.from(INTENT_KINDS),
  intentStatuses: Array.from(INTENT_STATUSES),
  mutableCustomerFields: ['displayName', 'tags', 'notes']
})

export function createCustomerInsights({ root, filePath } = {}) {
  const stateFile = filePath || path.join(root, 'data/core/customer-insights.json')
  if (customerInsightsSqliteAvailable && process.env.CHIHIRO_CUSTOMER_INSIGHTS_STORE !== 'json') {
    return createSqliteCustomerInsightsStore(stateFile)
  }
  return createJsonCustomerInsightsStore(stateFile)
}

export function customerKey(accountId, channel, peerId) {
  return [accountId, channel, peerId].map((value) => String(value ?? '')).join(ID_PART_SEPARATOR)
}

export function customerIdFor(accountId, channel, peerId) {
  return `cust_${createHash('sha256').update(customerKey(accountId, channel, peerId)).digest('hex').slice(0, 24)}`
}

export function normalizeIngestion(input) {
  const body = requireObject(input, 'body')
  const accountId = cleanRequiredString(body.accountId, 'accountId', 128)
  const channel = cleanRequiredString(body.channel, 'channel', 32)
  const peerId = cleanRequiredString(body.peerId, 'peerId', 128)
  const peerType = cleanOptionalString(body.peerType, 32) || 'person'
  const displayName = cleanOptionalString(body.displayName, 160)
  const source = normalizeSource(body.source)
  if (source.accountId && source.accountId !== accountId) throw new Error('source_account_mismatch')
  const facts = Array.isArray(body.facts) ? body.facts.map(normalizeFact) : []
  const intents = Array.isArray(body.intents) ? body.intents.map(normalizeIntent) : []
  if (!facts.length && !intents.length && !displayName) throw new Error('missing_insights')
  return {
    accountId,
    channel,
    peerId,
    peerType,
    displayName,
    source,
    facts,
    intents,
    observedAt: normalizeTime(body.observedAt) || Date.now()
  }
}

export function normalizeCustomerPatch(input) {
  const body = requireObject(input, 'body')
  const patch = {}
  if (Object.hasOwn(body, 'displayName')) patch.displayName = cleanOptionalString(body.displayName, 160)
  if (Object.hasOwn(body, 'notes')) patch.notes = cleanOptionalString(body.notes, 5000)
  if (Object.hasOwn(body, 'tags')) {
    if (!Array.isArray(body.tags)) throw new Error('invalid_tags')
    const seen = new Set()
    patch.tags = []
    for (const tag of body.tags) {
      const clean = cleanRequiredString(tag, 'tag', 64)
      if (!seen.has(clean)) {
        seen.add(clean)
        patch.tags.push(clean)
      }
    }
  }
  if (!Object.keys(patch).length) throw new Error('missing_update_fields')
  return patch
}

function createJsonCustomerInsightsStore(filePath) {
  function load() {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      return {
        customers: data.customers || {},
        facts: data.facts || {},
        intents: data.intents || {},
        evidence: data.evidence || {}
      }
    } catch {
      return emptyState()
    }
  }

  function save(data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n')
    fs.renameSync(tmp, filePath)
  }

  function mutate(fn) {
    const data = load()
    const result = fn(data) || data
    save(result)
    return result
  }

  return createCustomerInsightsApi({
    load,
    mutate,
    filePath,
    kind: 'json'
  })
}

function createSqliteCustomerInsightsStore(filePath) {
  if (!DatabaseSync) throw new Error('sqlite_unavailable')
  const dbPath = filePath.endsWith('.json') ? `${filePath.slice(0, -5)}.sqlite` : `${filePath}.sqlite`
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS customer_profiles (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      peer_id TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(account_id, channel, peer_id)
    );
    CREATE TABLE IF NOT EXISTS customer_facts (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customer_intents (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customer_evidence (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      value TEXT NOT NULL,
      observed_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_customer_profiles_account ON customer_profiles(account_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_customer_facts_customer ON customer_facts(customer_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_customer_intents_customer ON customer_intents(customer_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_customer_evidence_customer ON customer_evidence(customer_id, observed_at DESC);
  `)

  const load = () => {
    const customers = Object.fromEntries(db.prepare('SELECT id, value FROM customer_profiles').all().map((row) => [row.id, JSON.parse(row.value)]))
    const facts = Object.fromEntries(db.prepare('SELECT id, value FROM customer_facts').all().map((row) => [row.id, JSON.parse(row.value)]))
    const intents = Object.fromEntries(db.prepare('SELECT id, value FROM customer_intents').all().map((row) => [row.id, JSON.parse(row.value)]))
    const evidence = Object.fromEntries(db.prepare('SELECT id, value FROM customer_evidence').all().map((row) => [row.id, JSON.parse(row.value)]))
    return { customers, facts, intents, evidence }
  }
  const mutate = (fn) => transaction(db, () => {
    const data = load()
    const result = fn(data) || data
    const profile = db.prepare('INSERT OR REPLACE INTO customer_profiles(id, account_id, channel, peer_id, value, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    const fact = db.prepare('INSERT OR REPLACE INTO customer_facts(id, customer_id, account_id, value, updated_at) VALUES (?, ?, ?, ?, ?)')
    const intent = db.prepare('INSERT OR REPLACE INTO customer_intents(id, customer_id, account_id, value, updated_at) VALUES (?, ?, ?, ?, ?)')
    const evidenceStmt = db.prepare('INSERT OR REPLACE INTO customer_evidence(id, customer_id, account_id, value, observed_at) VALUES (?, ?, ?, ?, ?)')
    for (const customer of Object.values(result.customers || {})) {
      profile.run(customer.id, customer.accountId, customer.channel, customer.peerId, JSON.stringify(customer), customer.updatedAt || 0)
    }
    for (const item of Object.values(result.facts || {})) {
      fact.run(item.id, item.customerId, item.accountId, JSON.stringify(item), item.updatedAt || 0)
    }
    for (const item of Object.values(result.intents || {})) {
      intent.run(item.id, item.customerId, item.accountId, JSON.stringify(item), item.updatedAt || 0)
    }
    for (const item of Object.values(result.evidence || {})) {
      evidenceStmt.run(item.id, item.customerId, item.accountId, JSON.stringify(item), item.observedAt || 0)
    }
    return result
  })
  return createCustomerInsightsApi({ load, mutate, filePath: dbPath, kind: 'sqlite' })
}

function createCustomerInsightsApi({ load, mutate, filePath, kind }) {
  function ingest(raw) {
    const input = normalizeIngestion(raw)
    let customerId = ''
    mutate((data) => {
      ensureCollections(data)
      const now = Date.now()
      customerId = customerIdFor(input.accountId, input.channel, input.peerId)
      const existing = data.customers[customerId]
      const source = { ...input.source, id: evidenceIdFor(customerId, input.source) }
      const customer = existing || {
        id: customerId,
        accountId: input.accountId,
        channel: input.channel,
        peerId: input.peerId,
        peerType: input.peerType,
        displayName: '',
        tags: [],
        notes: '',
        createdAt: now,
        updatedAt: now,
        lastEvidenceAt: 0,
        factCount: 0,
        intentCount: 0,
        openIntentCount: 0
      }
      if (input.displayName) customer.displayName = input.displayName
      customer.peerType = input.peerType || customer.peerType
      customer.updatedAt = Math.max(customer.updatedAt || 0, input.observedAt, now)
      customer.lastEvidenceAt = Math.max(customer.lastEvidenceAt || 0, input.observedAt)
      data.customers[customerId] = customer
      data.evidence[source.id] = {
        ...source,
        customerId,
        accountId: input.accountId,
        channel: input.channel,
        peerId: input.peerId,
        observedAt: input.observedAt
      }
      for (const fact of input.facts) {
        const id = factIdFor(customerId, fact.kind, fact.value)
        data.facts[id] = aggregateEvidenceBackedItem(data.facts[id], {
          ...fact,
          id,
          customerId,
          accountId: input.accountId,
          sourceIds: [source.id],
          createdAt: input.observedAt,
          updatedAt: input.observedAt
        })
      }
      for (const intent of input.intents) {
        const id = intentIdFor(customerId, intent.kind, intent.label)
        data.intents[id] = aggregateEvidenceBackedItem(data.intents[id], {
          ...intent,
          id,
          customerId,
          accountId: input.accountId,
          sourceIds: [source.id],
          createdAt: input.observedAt,
          updatedAt: input.observedAt
        })
      }
      refreshSummary(data, customerId)
      return data
    })
    return get(customerId)
  }

  function list({ accountId, channel, q, limit = 50, offset = 0 } = {}) {
    if (!accountId) throw new Error('missing_account')
    const cleanChannel = channel ? cleanRequiredString(channel, 'channel', 32) : ''
    const needle = q ? String(q).trim().toLowerCase() : ''
    const max = clampInteger(limit, 50, 1, 200)
    const start = clampInteger(offset, 0, 0, 1000000)
    const data = load()
    const all = Object.values(data.customers || {})
      .filter((customer) => customer.accountId === accountId)
      .filter((customer) => !cleanChannel || customer.channel === cleanChannel)
      .filter((customer) => !needle || customerSearchText(customer).includes(needle))
      .sort((a, b) => (b.lastEvidenceAt || b.updatedAt || 0) - (a.lastEvidenceAt || a.updatedAt || 0))
      .map((customer) => summarizeCustomer(data, customer))
    return { customers: all.slice(start, start + max), total: all.length, limit: max, offset: start }
  }

  function get(id, { accountId } = {}) {
    const data = load()
    const customer = data.customers?.[id]
    if (!customer) throw new Error('customer_not_found')
    if (accountId && customer.accountId !== accountId) throw new Error('customer_not_found')
    return detailCustomer(data, customer)
  }

  function update(id, rawPatch, { accountId } = {}) {
    const patch = normalizeCustomerPatch(rawPatch)
    let updated
    mutate((data) => {
      ensureCollections(data)
      const customer = data.customers[id]
      if (!customer || (accountId && customer.accountId !== accountId)) throw new Error('customer_not_found')
      updated = {
        ...customer,
        ...patch,
        updatedAt: Date.now()
      }
      data.customers[id] = updated
      return data
    })
    return get(updated.id, { accountId })
  }

  return {
    ingest,
    list,
    get,
    update,
    load,
    filePath,
    kind
  }
}

function aggregateEvidenceBackedItem(existing, next) {
  if (!existing) return next
  const sourceIds = Array.from(new Set([...(existing.sourceIds || []), ...(next.sourceIds || [])])).sort()
  return {
    ...existing,
    ...next,
    confidence: Math.max(Number(existing.confidence || 0), Number(next.confidence || 0)),
    score: Math.max(Number(existing.score || 0), Number(next.score || 0)),
    sourceIds,
    createdAt: Math.min(existing.createdAt || next.createdAt, next.createdAt),
    updatedAt: Math.max(existing.updatedAt || 0, next.updatedAt || 0)
  }
}

function refreshSummary(data, customerId) {
  const customer = data.customers[customerId]
  if (!customer) return
  const facts = Object.values(data.facts || {}).filter((item) => item.customerId === customerId)
  const intents = Object.values(data.intents || {}).filter((item) => item.customerId === customerId)
  customer.factCount = facts.length
  customer.intentCount = intents.length
  customer.openIntentCount = intents.filter((item) => (item.status || 'open') === 'open').length
  customer.updatedAt = Math.max(customer.updatedAt || 0, ...facts.map((item) => item.updatedAt || 0), ...intents.map((item) => item.updatedAt || 0))
}

function summarizeCustomer(data, customer) {
  const intents = Object.values(data.intents || {}).filter((item) => item.customerId === customer.id)
  const topIntent = intents
    .filter((item) => (item.status || 'open') === 'open')
    .sort((a, b) => (Number(b.score || 0) - Number(a.score || 0)) || String(a.label).localeCompare(String(b.label)))[0] || null
  return {
    id: customer.id,
    accountId: customer.accountId,
    channel: customer.channel,
    peerId: customer.peerId,
    peerType: customer.peerType,
    displayName: customer.displayName || customer.peerId,
    tags: customer.tags || [],
    notes: customer.notes || '',
    factCount: customer.factCount || 0,
    intentCount: customer.intentCount || 0,
    openIntentCount: customer.openIntentCount || 0,
    topIntent,
    lastEvidenceAt: customer.lastEvidenceAt || 0,
    updatedAt: customer.updatedAt || 0
  }
}

function detailCustomer(data, customer) {
  return {
    ...summarizeCustomer(data, customer),
    facts: Object.values(data.facts || {})
      .filter((item) => item.customerId === customer.id)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0) || String(a.kind).localeCompare(String(b.kind)))
      .map((item) => attachSources(data, item)),
    intents: Object.values(data.intents || {})
      .filter((item) => item.customerId === customer.id)
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || (b.updatedAt || 0) - (a.updatedAt || 0))
      .map((item) => attachSources(data, item)),
    evidence: Object.values(data.evidence || {})
      .filter((item) => item.customerId === customer.id)
      .sort((a, b) => (b.observedAt || 0) - (a.observedAt || 0))
  }
}

function attachSources(data, item) {
  return {
    ...item,
    sources: (item.sourceIds || []).map((id) => data.evidence?.[id]).filter(Boolean)
  }
}

function customerSearchText(customer) {
  return [
    customer.displayName,
    customer.peerId,
    ...(customer.tags || []),
    customer.notes
  ].filter(Boolean).join('\n').toLowerCase()
}

function normalizeSource(source) {
  const raw = requireObject(source, 'source')
  const accountId = cleanOptionalString(raw.accountId, 128)
  const conversationId = cleanRequiredString(raw.conversationId, 'source.conversationId', 256)
  const messageId = cleanRequiredString(raw.messageId, 'source.messageId', 160)
  const messageAt = normalizeTime(raw.messageAt)
  const text = cleanOptionalString(raw.text, 2000)
  return {
    accountId,
    conversationId,
    messageId,
    messageAt,
    text
  }
}

function normalizeFact(raw) {
  const item = requireObject(raw, 'fact')
  const kind = cleanRequiredString(item.kind, 'fact.kind', 64)
  if (!FACT_KINDS.has(kind)) throw new Error('invalid_fact_kind')
  const value = cleanRequiredString(item.value, 'fact.value', 1000)
  const confidence = clampNumber(item.confidence, 0.5, 0, 1)
  return {
    kind,
    value,
    confidence
  }
}

function normalizeIntent(raw) {
  const item = requireObject(raw, 'intent')
  const kind = cleanRequiredString(item.kind, 'intent.kind', 64)
  if (!INTENT_KINDS.has(kind)) throw new Error('invalid_intent_kind')
  const label = cleanOptionalString(item.label, 240) || kind
  const score = clampNumber(item.score, 0.5, 0, 1)
  const status = cleanOptionalString(item.status, 32) || 'open'
  if (!INTENT_STATUSES.has(status)) throw new Error('invalid_intent_status')
  return {
    kind,
    label,
    score,
    status
  }
}

function evidenceIdFor(customerId, source) {
  return `ev_${hashParts(customerId, source.conversationId, source.messageId)}`
}

function factIdFor(customerId, kind, value) {
  return `fact_${hashParts(customerId, kind, normalizeValue(value))}`
}

function intentIdFor(customerId, kind, label) {
  return `intent_${hashParts(customerId, kind, normalizeValue(label))}`
}

function hashParts(...parts) {
  return createHash('sha256').update(parts.map((part) => String(part ?? '')).join(ID_PART_SEPARATOR)).digest('hex').slice(0, 24)
}

function normalizeValue(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`invalid_${name}`)
  return value
}

function cleanRequiredString(value, name, max) {
  const text = cleanOptionalString(value, max)
  if (!text) throw new Error(`missing_${name.replaceAll('.', '_')}`)
  return text
}

function cleanOptionalString(value, max) {
  if (value == null) return ''
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('invalid_string')
  const text = String(value).trim()
  if (text.length > max) throw new Error('string_too_long')
  return text
}

function normalizeTime(value) {
  if (value == null || value === '') return 0
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) throw new Error('invalid_time')
  return Math.floor(n)
}

function clampNumber(value, def, min, max) {
  if (value == null || value === '') return def
  const n = Number(value)
  if (!Number.isFinite(n) || n < min || n > max) throw new Error('invalid_number')
  return n
}

function clampInteger(value, def, min, max) {
  if (value == null || value === '') return def
  const n = Number(value)
  if (!Number.isFinite(n)) return def
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function ensureCollections(data) {
  data.customers = data.customers || {}
  data.facts = data.facts || {}
  data.intents = data.intents || {}
  data.evidence = data.evidence || {}
}

function emptyState() {
  return { customers: {}, facts: {}, intents: {}, evidence: {} }
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
