import assert from 'node:assert/strict'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import test from 'node:test'

import { createRuntime } from '../src/runtime/api.mjs'

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return server.address().port
}

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'chihiro-runtime-customers-'))
  const previous = process.env.CHIHIRO_CUSTOMER_INSIGHTS_STORE
  process.env.CHIHIRO_CUSTOMER_INSIGHTS_STORE = 'json'
  t.after(() => {
    if (previous === undefined) delete process.env.CHIHIRO_CUSTOMER_INSIGHTS_STORE
    else process.env.CHIHIRO_CUSTOMER_INSIGHTS_STORE = previous
  })
  const qq = {
    snapshot: () => ({ accounts: { accounts: [] } }),
    subscribe: () => () => {},
    refreshPorts: async () => {},
  }
  const astrbot = { refreshStatus: async () => ({}), stopIfOwned: async () => {} }
  const bot = { wired: new Set(), sync: async () => {}, unwireBeforeRemove: async () => {} }
  const chatui = { handle: () => false }
  const runtime = createRuntime({ root, cfg: {}, services: { qq, astrbot, bot, chatui } })
  const server = http.createServer(async (req, res) => {
    const handled = await runtime.handle(req, res, new URL(req.url, 'http://runtime.test'))
    if (!handled) { res.writeHead(404); res.end() }
  })
  const port = await listen(server)
  t.after(async () => {
    await runtime.shutdown()
    await new Promise((resolve) => server.close(resolve))
    await rm(root, { recursive: true, force: true })
  })
  return { base: `http://127.0.0.1:${port}`, runtime }
}

function event(overrides = {}) {
  return {
    accountId: 'qq:100',
    channel: 'qq',
    peerId: '200',
    displayName: '李四',
    observedAt: 100,
    source: {
      conversationId: 'qq:100:private:200',
      messageId: 'msg-1',
      messageAt: 90,
      text: '我想了解购买价格'
    },
    facts: [{ kind: 'need', value: '了解购买价格', confidence: 0.8 }],
    intents: [{ kind: 'purchase', label: '购买咨询', score: 0.9 }],
    ...overrides
  }
}

async function postJson(url, body, headers = {}) {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  })
}

test('runtime exposes ingest, list, detail, and update customer endpoints', async (t) => {
  const f = await fixture(t)
  const ingest = await postJson(`${f.base}/api/runtime/customers/ingest`, event(), { 'x-chihiro-account': 'qq:100' })
  assert.equal(ingest.status, 200)
  const created = await ingest.json()
  assert.equal(created.displayName, '李四')
  assert.equal(created.facts[0].sources[0].messageId, 'msg-1')

  const list = await fetch(`${f.base}/api/runtime/customers`, { headers: { 'x-chihiro-account': 'qq:100' } })
  assert.equal(list.status, 200)
  assert.deepEqual((await list.json()).customers.map((customer) => customer.id), [created.id])

  const detail = await fetch(`${f.base}/api/runtime/customers/${encodeURIComponent(created.id)}`, { headers: { 'x-chihiro-account': 'qq:100' } })
  assert.equal(detail.status, 200)
  assert.equal((await detail.json()).intents[0].sources[0].conversationId, 'qq:100:private:200')

  const update = await fetch(`${f.base}/api/runtime/customers/${encodeURIComponent(created.id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-chihiro-account': 'qq:100' },
    body: JSON.stringify({ displayName: '李四老师', tags: ['vip', 'vip', 'demo'], notes: '需要演示' })
  })
  assert.equal(update.status, 200)
  const updated = await update.json()
  assert.equal(updated.displayName, '李四老师')
  assert.deepEqual(updated.tags, ['vip', 'demo'])
  assert.equal(updated.notes, '需要演示')
})

test('runtime customer endpoints enforce account boundaries', async (t) => {
  const f = await fixture(t)
  const created = await (await postJson(`${f.base}/api/runtime/customers/ingest`, event(), { 'x-chihiro-account': 'qq:100' })).json()

  const mismatch = await postJson(`${f.base}/api/runtime/customers/ingest`, event(), { 'x-chihiro-account': 'qq:101' })
  assert.equal(mismatch.status, 400)
  assert.equal((await mismatch.json()).error, 'account_mismatch')

  const hiddenList = await fetch(`${f.base}/api/runtime/customers`, { headers: { 'x-chihiro-account': 'qq:101' } })
  assert.equal(hiddenList.status, 200)
  assert.deepEqual((await hiddenList.json()).customers, [])

  const hiddenDetail = await fetch(`${f.base}/api/runtime/customers/${created.id}`, { headers: { 'x-chihiro-account': 'qq:101' } })
  assert.equal(hiddenDetail.status, 404)

  const unscopedDetail = await fetch(`${f.base}/api/runtime/customers/${created.id}`)
  assert.equal(unscopedDetail.status, 400)
  assert.equal((await unscopedDetail.json()).error, 'missing_account')
})

test('runtime customer endpoints reject invalid payloads before mutation', async (t) => {
  const f = await fixture(t)
  const missingSource = await postJson(`${f.base}/api/runtime/customers/ingest`, { accountId: 'qq:100', channel: 'qq', peerId: '200', facts: [{ kind: 'need', value: 'x' }] })
  assert.equal(missingSource.status, 400)
  assert.equal((await missingSource.json()).error, 'invalid_source')

  const invalidKind = await postJson(`${f.base}/api/runtime/customers/ingest`, event({ intents: [{ kind: 'spam', label: 'x' }] }))
  assert.equal(invalidKind.status, 400)
  assert.equal((await invalidKind.json()).error, 'invalid_intent_kind')

  const list = await fetch(`${f.base}/api/runtime/customers?accountId=qq:100`)
  assert.equal((await list.json()).total, 0)
})
