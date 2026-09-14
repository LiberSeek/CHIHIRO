import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { createCustomerInsights, customerIdFor } from '../../src/core/customer-insights.mjs'

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chihiro-customers-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const previous = process.env.CHIHIRO_CUSTOMER_INSIGHTS_STORE
  process.env.CHIHIRO_CUSTOMER_INSIGHTS_STORE = 'json'
  t.after(() => {
    if (previous === undefined) delete process.env.CHIHIRO_CUSTOMER_INSIGHTS_STORE
    else process.env.CHIHIRO_CUSTOMER_INSIGHTS_STORE = previous
  })
  return { root, store: createCustomerInsights({ root }) }
}

function baseEvent(overrides = {}) {
  return {
    accountId: 'qq:100',
    channel: 'qq',
    peerId: '200',
    peerType: 'person',
    displayName: '张三',
    observedAt: 1000,
    source: {
      conversationId: 'qq:100:private:200',
      messageId: 'm-1',
      messageAt: 900,
      text: '预算 5000，想了解价格'
    },
    facts: [
      { kind: 'budget', value: '5000', confidence: 0.7 }
    ],
    intents: [
      { kind: 'pricing', label: '询价', score: 0.8 }
    ],
    ...overrides
  }
}

test('ingestion is deterministic and keeps source provenance', (t) => {
  const { store } = fixture(t)
  const first = store.ingest(baseEvent())
  const second = store.ingest(baseEvent({
    facts: [{ kind: 'budget', value: '5000', confidence: 0.9 }],
    intents: [{ kind: 'pricing', label: '询价', score: 0.95 }]
  }))

  assert.equal(second.id, first.id)
  assert.equal(second.facts.length, 1)
  assert.equal(second.intents.length, 1)
  assert.equal(second.evidence.length, 1)
  assert.equal(second.facts[0].confidence, 0.9)
  assert.equal(second.intents[0].score, 0.95)
  assert.deepEqual(second.facts[0].sources.map((source) => source.messageId), ['m-1'])
  assert.equal(second.id, customerIdFor('qq:100', 'qq', '200'))
})

test('same peer on different accounts remains isolated', (t) => {
  const { store } = fixture(t)
  const first = store.ingest(baseEvent({ accountId: 'qq:100', source: { conversationId: 'qq:100:private:200', messageId: 'm-1' } }))
  const second = store.ingest(baseEvent({ accountId: 'qq:101', source: { conversationId: 'qq:101:private:200', messageId: 'm-1' } }))

  assert.notEqual(first.id, second.id)
  assert.deepEqual(store.list({ accountId: 'qq:100' }).customers.map((item) => item.id), [first.id])
  assert.deepEqual(store.list({ accountId: 'qq:101' }).customers.map((item) => item.id), [second.id])
  assert.throws(() => store.get(first.id, { accountId: 'qq:101' }), /customer_not_found/)
})

test('source references accumulate without duplicating repeated message evidence', (t) => {
  const { store } = fixture(t)
  const first = store.ingest(baseEvent())
  const detail = store.ingest(baseEvent({
    observedAt: 2000,
    source: {
      conversationId: 'qq:100:private:200',
      messageId: 'm-2',
      messageAt: 1900,
      text: '预算 5000，尽快安排演示'
    },
    facts: [
      { kind: 'budget', value: '5000', confidence: 0.6 }
    ],
    intents: [
      { kind: 'meeting', label: '安排演示', score: 0.85 }
    ]
  }))

  assert.equal(detail.id, first.id)
  assert.equal(detail.evidence.length, 2)
  assert.equal(detail.facts.length, 1)
  assert.equal(detail.intents.length, 2)
  assert.deepEqual(detail.evidence.map((source) => source.messageId), ['m-2', 'm-1'])
  assert.deepEqual(detail.facts[0].sources.map((source) => source.messageId).sort(), ['m-1', 'm-2'])
})

test('profiles survive store recreation from disk', (t) => {
  const { root, store } = fixture(t)
  const created = store.ingest(baseEvent())
  store.update(created.id, { tags: ['vip', '教育'], notes: '下周跟进' }, { accountId: 'qq:100' })

  const restarted = createCustomerInsights({ root })
  const detail = restarted.get(created.id, { accountId: 'qq:100' })
  assert.equal(detail.displayName, '张三')
  assert.deepEqual(detail.tags, ['vip', '教育'])
  assert.equal(detail.notes, '下周跟进')
  assert.equal(detail.facts[0].sources[0].conversationId, 'qq:100:private:200')
})

test('invalid ingestion and updates are rejected', (t) => {
  const { store } = fixture(t)
  assert.throws(() => store.ingest({ ...baseEvent(), source: { conversationId: 'c' } }), /missing_source_messageId/)
  assert.throws(() => store.ingest({ ...baseEvent(), source: { accountId: 'qq:other', conversationId: 'c', messageId: 'm' } }), /source_account_mismatch/)
  assert.throws(() => store.ingest({ ...baseEvent(), facts: [{ kind: 'unsupported', value: 'x' }] }), /invalid_fact_kind/)
  assert.throws(() => store.ingest({ ...baseEvent(), intents: [{ kind: 'pricing', label: 'x', score: 2 }] }), /invalid_number/)
  const customer = store.ingest(baseEvent())
  assert.throws(() => store.update(customer.id, { tags: 'vip' }, { accountId: 'qq:100' }), /invalid_tags/)
  assert.throws(() => store.update(customer.id, { tags: ['vip'] }, { accountId: 'qq:101' }), /customer_not_found/)
})
