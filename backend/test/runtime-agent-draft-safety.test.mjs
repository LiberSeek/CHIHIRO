import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'

import { createAgentController } from '../src/runtime/agent.mjs'
import { createAgentStore, sessionKey } from '../src/runtime/agent-store.mjs'

function fixture(hosted = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chihiro-agent-'))
  const account = { id: 'qq:10001', botSessions: { 'private:20002': hosted } }
  const accounts = { list: () => ({ accounts: [account] }) }
  const qq = {
    getInstanceForAccount: () => ({ ports: { http: 3001 }, tokens: { http: 'test' } }),
    snapshot: () => ({ accounts: { accounts: [account] } }),
  }
  const controller = createAgentController({ root, store: accounts, qq, astrbot: {}, cfg: {} })
  const key = sessionKey(account.id, 'private', '20002')
  controller.persist.upsertSession({ key, accountId: account.id, type: 'private', peerId: '20002' })
  const draft = controller.persist.addDraft({
    accountId: account.id, sessionKey: key, type: 'private', peerId: '20002', text: 'hello',
  })
  return { root, controller, draft }
}

async function postAgent(controller, pathname, body) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))])
  req.method = 'POST'
  let status = 0
  let responseBody = ''
  let finish
  const finished = new Promise((resolve) => { finish = resolve })
  const res = {
    writeHead(code) { status = code },
    end(chunk = '') { responseBody += String(chunk); finish() },
  }
  const handled = await controller.handleHttp(req, res, new URL(pathname, 'http://runtime.test'))
  await finished
  return { handled, status, body: JSON.parse(responseBody) }
}

test('concurrent approvals claim once and persist the NapCat receipt', async (t) => {
  const { root, controller, draft } = fixture()
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  let sends = 0
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => {
    sends++
    await new Promise((resolve) => setTimeout(resolve, 20))
    return { ok: true, json: async () => ({ status: 'ok', retcode: 0, data: { message_id: 99 } }) }
  }

  const results = await Promise.allSettled([
    controller.approveDraft(draft.id, { accountId: 'qq:10001', type: 'private', peerId: '20002' }),
    controller.approveDraft(draft.id, { accountId: 'qq:10001', type: 'private', peerId: '20002' }),
  ])

  assert.equal(sends, 1)
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  assert.equal(controller.persist.getDraft(draft.id).status, 'sent')
  assert.deepEqual(controller.persist.getDraft(draft.id).receipt, { message_id: 99 })
  const outbox = controller.persist.getOutboxForDraft(draft.id)
  assert.equal(outbox.status, 'sent')
  assert.deepEqual(outbox.receipt, { message_id: 99 })
  const attempts = controller.persist.listDeliveryAttempts(outbox.id)
  assert.equal(attempts.length, 1)
  assert.equal(attempts[0].number, 1)
  assert.equal(attempts[0].status, 'sent')
  assert.deepEqual(attempts[0].receipt, { message_id: 99 })
  assert.ok(attempts[0].completedAt >= attempts[0].startedAt)
})

test('approved drafts send in durable per-conversation order', async (t) => {
  const { root, controller, draft: first } = fixture()
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const second = controller.persist.addDraft({
    accountId: first.accountId,
    sessionKey: first.sessionKey,
    type: first.type,
    peerId: first.peerId,
    text: 'second',
  })
  const calls = []
  let releaseFirst
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async (_url, options) => {
    const message = JSON.parse(options.body).message
    calls.push(message)
    if (message === 'hello') await new Promise((resolve) => { releaseFirst = resolve })
    return { ok: true, json: async () => ({ status: 'ok', retcode: 0, data: { message_id: calls.length } }) }
  }

  const firstApproval = controller.approveDraft(first.id)
  const secondApproval = controller.approveDraft(second.id)
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(calls, ['hello'])
  assert.equal(controller.persist.getDraft(second.id).status, 'queued')
  releaseFirst()
  await Promise.all([firstApproval, secondApproval])

  assert.deepEqual(calls, ['hello', 'second'])
  assert.equal(controller.persist.getDraft(first.id).status, 'sent')
  assert.equal(controller.persist.getDraft(second.id).status, 'sent')
  assert.deepEqual(
    controller.persist.listOutbox(first.sessionKey).map((item) => [item.sequence, item.message, item.status]),
    [[1, 'hello', 'sent'], [2, 'second', 'sent']],
  )
})

test('approval rejects supplied conversation mismatch before sending', async (t) => {
  const { root, controller, draft } = fixture()
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  let sends = 0
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => { sends++; throw new Error('unexpected') }

  await assert.rejects(
    controller.approveDraft(draft.id, { accountId: 'qq:other', type: 'private', peerId: '20002' }),
    /draft_account_mismatch/,
  )
  assert.equal(sends, 0)
  assert.equal(controller.persist.getDraft(draft.id).status, 'pending')
})

test('ambiguous send failure becomes unknown and cannot be retried', async (t) => {
  const { root, controller, draft } = fixture()
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  let sends = 0
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => { sends++; throw new Error('connection_lost') }

  await assert.rejects(controller.approveDraft(draft.id), /connection_lost/)
  assert.equal(controller.persist.getDraft(draft.id).status, 'unknown')
  assert.equal(controller.persist.getSession(draft.sessionKey).status, 'delivery_unknown')
  const outbox = controller.persist.getOutboxForDraft(draft.id)
  assert.equal(outbox.status, 'unknown')
  assert.equal(outbox.error, 'connection_lost')
  assert.deepEqual(
    controller.persist.listDeliveryAttempts(outbox.id).map((attempt) => attempt.status),
    ['unknown'],
  )
  await assert.rejects(controller.approveDraft(draft.id), /draft_not_found/)
  assert.equal(sends, 1)
})

test('restart recovery persists an interrupted attempt as unknown', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chihiro-agent-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const file = path.join(root, 'state.json')
  const first = createAgentStore(file)
  const key = sessionKey('qq:1', 'private', '2')
  first.upsertSession({ key, accountId: 'qq:1', type: 'private', peerId: '2' })
  const draft = first.addDraft({ accountId: 'qq:1', sessionKey: key, type: 'private', peerId: '2' })
  const queued = first.enqueueDraft(draft.id)
  const claimed = first.claimNextOutbox(key)
  assert.equal(claimed.outbox.status, 'sending')
  assert.equal(claimed.attempt.status, 'sending')

  const restarted = createAgentStore(file)
  restarted.recoverSendingDrafts()
  assert.equal(restarted.getDraft(draft.id).status, 'unknown')
  assert.equal(restarted.getOutbox(queued.id).status, 'unknown')
  assert.equal(restarted.listDeliveryAttempts(queued.id)[0].status, 'unknown')
  assert.equal(restarted.listDeliveryAttempts(queued.id)[0].error, 'delivery_interrupted')
  assert.equal(restarted.claimNextOutbox(key), null)
})

test('controller startup resumes queued outbox deliveries', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chihiro-agent-restart-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const account = { id: 'qq:10001', botSessions: {} }
  const key = sessionKey(account.id, 'private', '20002')
  const store = createAgentStore(path.join(root, 'data/agent/state.json'))
  store.upsertSession({ key, accountId: account.id, type: 'private', peerId: '20002' })
  const draft = store.addDraft({
    accountId: account.id,
    sessionKey: key,
    type: 'private',
    peerId: '20002',
    text: 'resume me',
  })
  store.enqueueDraft(draft.id)
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  let sends = 0
  globalThis.fetch = async () => {
    sends++
    return { ok: true, json: async () => ({ status: 'ok', retcode: 0, data: { message_id: 501 } }) }
  }

  const controller = createAgentController({
    root,
    store: { list: () => ({ accounts: [account] }) },
    qq: { getInstanceForAccount: () => ({ ports: { http: 3001 }, tokens: { http: 'test' } }) },
    astrbot: {},
    cfg: {},
  })
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(sends, 1)
  assert.equal(controller.persist.getDraft(draft.id).status, 'sent')
  assert.equal(controller.persist.listDeliveryAttempts(controller.persist.getOutboxForDraft(draft.id).id)[0].status, 'sent')
})

test('conversation changes supersede pending and cancel queued drafts', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chihiro-agent-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const store = createAgentStore(path.join(root, 'state.json'))
  const key = sessionKey('qq:1', 'private', '2')
  const stale = store.addDraft({ accountId: 'qq:1', sessionKey: key, type: 'private', peerId: '2' })
  const queued = store.addDraft({ accountId: 'qq:1', sessionKey: key, type: 'private', peerId: '2' })
  const queuedOutbox = store.enqueueDraft(queued.id)
  const other = store.addDraft({ accountId: 'qq:1', sessionKey: sessionKey('qq:1', 'private', '3'), type: 'private', peerId: '3' })

  store.supersedePendingDrafts(key, 'new_inbound_message')

  assert.equal(store.getDraft(stale.id).status, 'superseded')
  assert.equal(store.getDraft(queued.id).status, 'canceled')
  assert.equal(store.getOutbox(queuedOutbox.id).status, 'canceled')
  assert.equal(store.getDraft(other.id).status, 'pending')
})

test('automatic replies wait for a real receipt and publish delivery state', async (t) => {
  const { root, controller } = fixture(true)
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  let finish
  globalThis.fetch = () => new Promise(resolve => { finish = resolve })
  const reply = controller.handleAgentOutbound('qq:10001', {
    action: 'send_private_msg', params: { user_id: 20002, message: 'automatic reply' }, echo: 'run-1'
  })
  assert.equal(controller.view('qq:10001').recentDrafts.filter(d => d.status === 'sending').length, 1)
  assert.equal(controller.view('qq:10001').sessions[0].status, 'pending_review')
  finish({ ok: true, json: async () => ({ status: 'ok', data: { message_id: 123 } }) })
  assert.deepEqual(await reply, { status: 'ok', retcode: 0, data: { message_id: 123 }, echo: 'run-1' })
  assert.equal(controller.view('qq:10001').recentDrafts.find(d => d.text === 'automatic reply').status, 'sent')
})

test('operator assistance holds every output chunk even under automatic mode', async (t) => {
  const { root, controller, draft } = fixture(true)
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  controller.persist.upsertSession({ ...controller.persist.getSession(draft.sessionKey), assistHold: true })
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => { throw new Error('Assistant output must not reach QQ') }
  for (let index = 0; index < 2; index++) {
    const result = await controller.handleAgentOutbound('qq:10001', {
      action: 'send_private_msg', params: { user_id: 20002, message: `chunk ${index}` }, echo: index
    })
    assert.equal(result.data.delivery_status, 'pending_review')
    assert.equal(result.data.message_id, 0)
  }
  assert.equal(controller.persist.getSession(draft.sessionKey).assistHold, true)
})

test('a successful HTTP envelope without a send receipt remains unknown', async (t) => {
  const { root, controller, draft } = fixture()
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ status: 'ok', data: {} }) })
  await assert.rejects(controller.approveDraft(draft.id), /missing_send_receipt/)
  assert.equal(controller.persist.getDraft(draft.id).status, 'unknown')
  const outbox = controller.persist.getOutboxForDraft(draft.id)
  assert.equal(outbox.status, 'unknown')
  assert.equal(controller.persist.listDeliveryAttempts(outbox.id)[0].status, 'unknown')
})

test('an unknown receipt blocks later drafts without sending them', async (t) => {
  const { root, controller, draft: first } = fixture()
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const second = controller.persist.addDraft({
    accountId: first.accountId,
    sessionKey: first.sessionKey,
    type: first.type,
    peerId: first.peerId,
    text: 'must wait',
  })
  let sends = 0
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => {
    sends++
    return { ok: true, json: async () => ({ status: 'ok', data: {} }) }
  }

  const results = await Promise.allSettled([
    controller.approveDraft(first.id),
    controller.approveDraft(second.id),
  ])

  assert.equal(sends, 1)
  assert.equal(results.filter((result) => result.status === 'rejected').length, 2)
  assert.equal(controller.persist.getDraft(first.id).status, 'unknown')
  assert.equal(controller.persist.getDraft(second.id).status, 'queued')
  assert.equal(controller.persist.getOutboxForDraft(second.id).status, 'queued')
  assert.equal(controller.persist.listDeliveryAttempts(controller.persist.getOutboxForDraft(second.id).id).length, 0)
})

test('reconcile marks unknown delivery sent with operator metadata and is idempotent', async (t) => {
  const { root, controller, draft } = fixture()
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  let sends = 0
  globalThis.fetch = async () => { sends++; throw new Error('connection_lost') }
  await assert.rejects(controller.approveDraft(draft.id), /connection_lost/)

  const target = {
    id: draft.id,
    accountId: draft.accountId,
    sessionKey: draft.sessionKey,
    type: draft.type,
    peerId: draft.peerId,
    resolution: 'sent',
  }
  const reconciled = controller.reconcileDraft(draft.id, target)
  assert.equal(reconciled.status, 'sent')
  assert.equal(sends, 1)
  assert.equal(reconciled.reconciliation.resolution, 'sent')
  assert.equal(reconciled.reconciliation.source, 'operator')
  assert.equal(typeof reconciled.reconciledAt, 'number')
  const outbox = controller.persist.getOutboxForDraft(draft.id)
  assert.equal(outbox.status, 'sent')
  assert.equal(outbox.reconciliation.resolution, 'sent')
  assert.equal(controller.persist.listDeliveryAttempts(outbox.id)[0].status, 'unknown')
  assert.equal(controller.persist.listDeliveryAttempts(outbox.id)[0].reconciliation.source, 'operator')

  const repeated = controller.reconcileDraft(draft.id, target)
  assert.deepEqual(repeated, reconciled)
  assert.equal(sends, 1)
})

test('reconcile releases later queued drafts without resending the reconciled draft', async (t) => {
  const { root, controller, draft: first } = fixture()
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const second = controller.persist.addDraft({
    accountId: first.accountId,
    sessionKey: first.sessionKey,
    type: first.type,
    peerId: first.peerId,
    text: 'after reconcile',
  })
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  let sends = 0
  globalThis.fetch = async () => { sends++; throw new Error('connection_lost') }
  await assert.rejects(controller.approveDraft(first.id), /connection_lost/)
  await assert.rejects(controller.approveDraft(second.id), /delivery_blocked_unknown/)
  assert.equal(sends, 1)

  globalThis.fetch = async () => {
    sends++
    return { ok: true, json: async () => ({ status: 'ok', retcode: 0, data: { message_id: 602 } }) }
  }
  const target = { id: first.id, accountId: first.accountId, sessionKey: first.sessionKey, type: first.type, peerId: first.peerId, resolution: 'sent' }
  const reconciled = controller.reconcileDraft(first.id, target)
  assert.equal(reconciled.status, 'sent')
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(sends, 2)
  assert.equal(controller.persist.getDraft(second.id).status, 'sent')
  assert.equal(controller.persist.getOutboxForDraft(second.id).receipt.message_id, 602)
})

test('reconcile and retry require every immutable target field', async (t) => {
  const { root, controller, draft } = fixture()
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => { throw new Error('connection_lost') }
  await assert.rejects(controller.approveDraft(draft.id), /connection_lost/)
  const target = { id: draft.id, accountId: draft.accountId, sessionKey: draft.sessionKey, type: draft.type, peerId: draft.peerId, resolution: 'sent' }

  await assert.rejects(
    Promise.resolve().then(() => controller.reconcileDraft(draft.id, { ...target, accountId: 'qq:other' })),
    /draft_account_mismatch/,
  )
  await assert.rejects(
    Promise.resolve().then(() => controller.reconcileDraft(draft.id, { ...target, peerId: '99999' })),
    /draft_peer_mismatch/,
  )
  await assert.rejects(
    controller.retryDraft(draft.id, { ...target, resolution: undefined, sessionKey: 'qq:10001:group:20002' }),
    /draft_session_mismatch/,
  )
  assert.equal(controller.persist.getDraft(draft.id).status, 'unknown')
})

test('explicit retry creates a new ordered outbox delivery for unknown draft', async (t) => {
  const { root, controller, draft } = fixture()
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => { throw new Error('connection_lost') }
  await assert.rejects(controller.approveDraft(draft.id), /connection_lost/)
  const previous = controller.persist.getOutboxForDraft(draft.id)
  let release
  let sends = 0
  globalThis.fetch = async () => {
    sends++
    await new Promise((resolve) => { release = resolve })
    return { ok: true, json: async () => ({ status: 'ok', retcode: 0, data: { message_id: 601 } }) }
  }
  const target = { id: draft.id, accountId: draft.accountId, sessionKey: draft.sessionKey, type: draft.type, peerId: draft.peerId }
  const retrying = controller.retryDraft(draft.id, target)
  await new Promise((resolve) => setImmediate(resolve))
  const duplicateRetry = controller.retryDraft(draft.id, target)
  const queued = controller.persist.getDraft(draft.id)
  const retried = controller.persist.getOutboxForDraft(draft.id)
  assert.equal(sends, 1)
  assert.equal(queued.status, 'sending')
  assert.notEqual(retried.id, previous.id)
  assert.equal(retried.retryOf, previous.id)
  assert.equal(retried.sequence, previous.sequence)
  assert.equal(retried.status, 'sending')
  assert.equal(retried.accountId, previous.accountId)
  assert.equal(retried.sessionKey, previous.sessionKey)
  assert.equal(retried.type, previous.type)
  assert.equal(retried.peerId, previous.peerId)
  assert.equal(controller.persist.getOutbox(previous.id).supersededBy, retried.id)
  release()
  const sent = await retrying
  const duplicateSent = await duplicateRetry
  assert.equal(sent.status, 'sent')
  assert.equal(duplicateSent.status, 'sent')
  assert.equal(controller.persist.listDeliveryAttempts(previous.id)[0].status, 'unknown')
  assert.equal(controller.persist.listDeliveryAttempts(retried.id)[0].status, 'sent')
})

test('frontend reconcile and retry HTTP routes return persisted draft transitions', async (t) => {
  const { root, controller, draft } = fixture()
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => { throw new Error('connection_lost') }
  await assert.rejects(controller.approveDraft(draft.id), /connection_lost/)
  const target = { id: draft.id, accountId: draft.accountId, sessionKey: draft.sessionKey, type: draft.type, peerId: draft.peerId }

  const mismatch = await postAgent(controller, '/api/runtime/agent/draft/reconcile', {
    ...target, peerId: '99999', resolution: 'sent',
  })
  assert.equal(mismatch.handled, true)
  assert.equal(mismatch.status, 400)
  assert.equal(mismatch.body.error, 'draft_peer_mismatch')

  const reconciled = await postAgent(controller, '/api/runtime/agent/draft/reconcile', {
    ...target, resolution: 'sent',
  })
  assert.equal(reconciled.status, 200)
  assert.equal(reconciled.body.draft.status, 'sent')
  assert.equal(reconciled.body.draft.reconciliation.source, 'operator')

  const failed = controller.persist.addDraft({
    accountId: draft.accountId,
    sessionKey: draft.sessionKey,
    type: draft.type,
    peerId: draft.peerId,
    text: 'retry route',
  })
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ status: 'failed', retcode: 1200, message: 'rejected' }) })
  await assert.rejects(controller.approveDraft(failed.id), /rejected/)
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ status: 'ok', retcode: 0, data: { message_id: 701 } }) })
  const retried = await postAgent(controller, '/api/runtime/agent/draft/retry', { ...target, id: failed.id })
  assert.equal(retried.status, 200)
  assert.equal(retried.body.draft.status, 'sent')
  assert.equal(retried.body.draft.receipt.message_id, 701)
})

test('a known NapCat rejection records failed and releases the next draft', async (t) => {
  const { root, controller, draft: first } = fixture()
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const second = controller.persist.addDraft({
    accountId: first.accountId,
    sessionKey: first.sessionKey,
    type: first.type,
    peerId: first.peerId,
    text: 'send after rejection',
  })
  let sends = 0
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => {
    sends++
    if (sends === 1) {
      return { ok: true, json: async () => ({ status: 'failed', retcode: 1200, message: 'rejected' }) }
    }
    return { ok: true, json: async () => ({ status: 'ok', retcode: 0, data: { message_id: 88 } }) }
  }

  const results = await Promise.allSettled([
    controller.approveDraft(first.id),
    controller.approveDraft(second.id),
  ])

  assert.equal(sends, 2)
  assert.equal(results[0].status, 'rejected')
  assert.equal(results[1].status, 'fulfilled')
  assert.equal(controller.persist.getDraft(first.id).status, 'failed')
  assert.equal(controller.persist.getDraft(second.id).status, 'sent')
  assert.equal(controller.persist.listDeliveryAttempts(controller.persist.getOutboxForDraft(first.id).id)[0].status, 'failed')
})

test('sqlite store imports legacy JSON once and preserves atomic draft claims', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chihiro-agent-sqlite-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const file = path.join(root, 'state.json')
  fs.writeFileSync(file, JSON.stringify({
    accountModes: { 'qq:1': 'ask' },
    sessions: {},
    drafts: { legacy: { id: 'legacy', accountId: 'qq:1', status: 'pending', createdAt: 1 } },
  }))
  const previous = process.env.CHIHIRO_AGENT_STORE
  delete process.env.CHIHIRO_AGENT_STORE
  t.after(() => {
    if (previous === undefined) delete process.env.CHIHIRO_AGENT_STORE
    else process.env.CHIHIRO_AGENT_STORE = previous
  })
  const first = createAgentStore(file)
  assert.equal(first.accountMode('qq:1'), 'ask')
  assert.equal(first.getDraft('legacy').text, undefined)
  const second = createAgentStore(file)
  assert.equal(second.listDrafts('qq:1').length, 1)
  assert.equal(second.claimDraft('legacy').status, 'sending')
  assert.equal(second.claimDraft('legacy'), null)
})
