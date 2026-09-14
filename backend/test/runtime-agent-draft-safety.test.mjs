import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { createAgentController } from '../src/runtime/agent.mjs'
import { createAgentStore, sessionKey } from '../src/runtime/agent-store.mjs'

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chihiro-agent-'))
  const account = { id: 'qq:10001' }
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
  await assert.rejects(controller.approveDraft(draft.id), /draft_not_found/)
  assert.equal(sends, 1)
})

test('restart recovery marks an interrupted sending draft unknown', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chihiro-agent-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const file = path.join(root, 'state.json')
  const first = createAgentStore(file)
  const draft = first.addDraft({ accountId: 'qq:1', type: 'private', peerId: '2' })
  assert.equal(first.claimDraft(draft.id).status, 'sending')

  const restarted = createAgentStore(file)
  restarted.recoverSendingDrafts()
  assert.equal(restarted.getDraft(draft.id).status, 'unknown')
  assert.equal(restarted.claimDraft(draft.id), null)
})

test('conversation changes supersede only pending drafts in that session', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chihiro-agent-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const store = createAgentStore(path.join(root, 'state.json'))
  const key = sessionKey('qq:1', 'private', '2')
  const stale = store.addDraft({ accountId: 'qq:1', sessionKey: key, type: 'private', peerId: '2' })
  const other = store.addDraft({ accountId: 'qq:1', sessionKey: sessionKey('qq:1', 'private', '3'), type: 'private', peerId: '3' })

  store.supersedePendingDrafts(key, 'new_inbound_message')

  assert.equal(store.getDraft(stale.id).status, 'superseded')
  assert.equal(store.getDraft(other.id).status, 'pending')
})
