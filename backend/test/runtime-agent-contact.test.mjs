import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'

import { createAgentController } from '../src/runtime/agent.mjs'

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chihiro-contact-'))
  const account = { id: 'qq:10001' }
  const accounts = { list: () => ({ accounts: [account] }) }
  const qq = {
    getInstanceForAccount: () => ({ ports: { http: 3001 }, tokens: { http: 'test' } }),
    snapshot: () => ({ accounts: { accounts: [account] } }),
  }
  const controller = createAgentController({ root, store: accounts, qq, astrbot: {}, cfg: {} })
  return { root, controller }
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

function mockNapcat(t, handler) {
  const originalFetch = globalThis.fetch
  const calls = []
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async (url, opts = {}) => {
    const action = String(url).split('/').pop()
    const body = opts.body ? JSON.parse(opts.body) : {}
    calls.push({ action, body })
    const data = await handler(action, body)
    return { ok: true, json: async () => ({ status: 'ok', retcode: 0, data }) }
  }
  return calls
}

test('add_friend skips NapCat when the user is already a friend', async (t) => {
  const { root, controller } = fixture()
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const calls = mockNapcat(t, async (action) => {
    if (action === 'get_friend_list') return [{ user_id: 20002, nickname: 'Raven' }]
    throw new Error(`unexpected ${action}`)
  })
  const res = await postAgent(controller, '/api/runtime/agent/contact', {
    accountId: 'qq:10001', action: 'add_friend', userId: '20002'
  })
  assert.equal(res.status, 200)
  assert.equal(res.body.already, true)
  assert.deepEqual(calls.map((c) => c.action), ['get_friend_list'])
})

test('add_friend submits a request for a new user', async (t) => {
  const { root, controller } = fixture()
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const calls = mockNapcat(t, async (action) => {
    if (action === 'get_friend_list') return []
    if (action === 'add_friend') return { submitted: true }
    throw new Error(`unexpected ${action}`)
  })
  const res = await postAgent(controller, '/api/runtime/agent/contact', {
    accountId: 'qq:10001', action: 'add_friend', userId: '308662170', message: '你好'
  })
  assert.equal(res.status, 200)
  assert.equal(res.body.already, false)
  assert.equal(calls.at(-1).action, 'add_friend')
  assert.equal(calls.at(-1).body.user_id, 308662170)
  assert.equal(calls.at(-1).body.message, '你好')
})

test('join_group skips NapCat when already a member', async (t) => {
  const { root, controller } = fixture()
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const calls = mockNapcat(t, async (action) => {
    if (action === 'get_group_list') return [{ group_id: 1108689896, group_name: 'demo' }]
    throw new Error(`unexpected ${action}`)
  })
  const res = await postAgent(controller, '/api/runtime/agent/contact', {
    accountId: 'qq:10001', action: 'join_group', groupId: '1108689896'
  })
  assert.equal(res.status, 200)
  assert.equal(res.body.already, true)
  assert.deepEqual(calls.map((c) => c.action), ['get_group_list'])
})

test('join_group submits for a new group', async (t) => {
  const { root, controller } = fixture()
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const calls = mockNapcat(t, async (action) => {
    if (action === 'get_group_list') return []
    if (action === 'join_group') return { submitted: true }
    throw new Error(`unexpected ${action}`)
  })
  const res = await postAgent(controller, '/api/runtime/agent/contact', {
    accountId: 'qq:10001', action: 'join_group', groupId: '123456', comment: '申请'
  })
  assert.equal(res.status, 200)
  assert.equal(res.body.already, false)
  assert.equal(calls.at(-1).action, 'join_group')
  assert.equal(calls.at(-1).body.group_id, 123456)
  assert.equal(calls.at(-1).body.comment, '申请')
})

test('join_group maps missing NapCat actions to a restart hint', async (t) => {
  const { root, controller } = fixture()
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async (url) => {
    const action = String(url).split('/').pop()
    if (action === 'get_group_list') {
      return { ok: true, json: async () => ({ status: 'ok', retcode: 0, data: [] }) }
    }
    return {
      ok: true,
      json: async () => ({
        status: 'failed',
        retcode: 200,
        data: null,
        message: '不支持的Api join_group',
        wording: '不支持的Api join_group'
      })
    }
  }
  const res = await postAgent(controller, '/api/runtime/agent/contact', {
    accountId: 'qq:10001', action: 'join_group', groupId: '123456'
  })
  assert.equal(res.status, 400)
  assert.match(res.body.message, /重启该账号/)
})

test('contact rejects invented ids and unknown actions', async (t) => {
  const { root, controller } = fixture()
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  mockNapcat(t, async () => ({}))
  const badUser = await postAgent(controller, '/api/runtime/agent/contact', {
    accountId: 'qq:10001', action: 'add_friend', userId: 'abc'
  })
  assert.equal(badUser.status, 400)
  assert.equal(badUser.body.error, 'invalid_user')
  const unknown = await postAgent(controller, '/api/runtime/agent/contact', {
    accountId: 'qq:10001', action: 'delete_friend', userId: '1'
  })
  assert.equal(unknown.status, 400)
  assert.equal(unknown.body.error, 'unknown_contact_action')
})
