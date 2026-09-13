import assert from 'node:assert/strict'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import test from 'node:test'
import { createRuntime } from '../../apps/runtime/src/api.mjs'

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return server.address().port
}

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'chihiro-im-'))
  const napcatRequests = []
  let napcatReply = { status: 'ok', retcode: 0, data: {} }
  const napcat = http.createServer((req, res) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      napcatRequests.push({ path: req.url, body: JSON.parse(Buffer.concat(chunks).toString() || '{}') })
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(napcatReply))
    })
  })
  const napcatPort = await listen(napcat)
  const qq = {
    snapshot: () => ({ accounts: { accounts: [] } }),
    subscribe: () => () => {},
    refreshPorts: async () => {},
    getInstanceForAccount: (accountId) => accountId === 'qq:100' ? {
      ports: { http: napcatPort }, tokens: { http: 'test-token' }
    } : null
  }
  const astrbot = { refreshStatus: async () => ({}), stopIfOwned: async () => {} }
  const bot = { wired: new Set(), sync: async () => {}, unwireBeforeRemove: async () => {} }
  const chatui = { handle: () => false }
  const runtime = createRuntime({ root, cfg: {}, services: { qq, astrbot, bot, chatui } })
  runtime.store.upsert({ id: 'qq:100', client: 'qq', uin: '100' })
  runtime.store.upsert({ id: 'qq:200', client: 'qq', uin: '200' }, { activate: false })
  const server = http.createServer(async (req, res) => {
    const handled = await runtime.handle(req, res, new URL(req.url, 'http://runtime.test'))
    if (!handled) { res.writeHead(404); res.end() }
  })
  const port = await listen(server)
  t.after(async () => {
    await runtime.shutdown()
    await Promise.all([
      new Promise((resolve) => server.close(resolve)),
      new Promise((resolve) => napcat.close(resolve))
    ])
    await rm(root, { recursive: true, force: true })
  })
  return {
    base: `http://127.0.0.1:${port}`,
    napcatRequests,
    setNapcatReply(value) { napcatReply = value },
    runtime
  }
}

test('reads QQ history through the real controller and rejects cross-account keys', async (t) => {
  const f = await fixture(t)
  f.setNapcatReply({ status: 'ok', retcode: 0, data: { messages: [
    { message_id: 7, time: 11, user_id: 123, message: [{ type: 'text', data: { text: 'hello' } }] }
  ] } })

  const response = await fetch(`${f.base}/api/runtime/im/conversations/${encodeURIComponent('qq:100:private:123')}/messages`, {
    headers: { 'x-chihiro-account': 'qq:100' }
  })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), [{ id: '7', text: 'hello', sender: '123', at: 11, outgoing: false }])
  assert.deepEqual(f.napcatRequests, [
    { path: '/get_stranger_info', body: { user_id: 123 } },
    { path: '/get_friend_msg_history', body: { user_id: '123', count: 100 } }
  ])

  const mismatch = await fetch(`${f.base}/api/runtime/im/conversations/${encodeURIComponent('qq:200:private:123')}/messages`, {
    headers: { 'x-chihiro-account': 'qq:100' }
  })
  assert.equal(mismatch.status, 400)
  assert.equal((await mismatch.json()).error, 'conversation_account_mismatch')
  assert.equal(f.napcatRequests.length, 2)
})

test('send persists only after NapCat success and returns its receipt', async (t) => {
  const f = await fixture(t)
  f.setNapcatReply({ status: 'failed', retcode: 1200, message: 'qq rejected' })
  const failed = await fetch(`${f.base}/api/runtime/im/send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-chihiro-account': 'qq:100' },
    body: JSON.stringify({ conversationId: 'qq:100:group:456', text: 'first' })
  })
  assert.equal(failed.status, 400)
  assert.equal((await failed.json()).error, 'qq rejected')
  assert.equal(f.runtime.agent.persist.getSession('qq:100:group:456'), null)

  f.setNapcatReply({ status: 'ok', retcode: 0, data: { message_id: 88 } })
  const sent = await fetch(`${f.base}/api/runtime/im/send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-chihiro-account': 'qq:100' },
    body: JSON.stringify({ conversationId: 'qq:100:group:456', text: 'second' })
  })
  assert.equal(sent.status, 200)
  assert.deepEqual(await sent.json(), { ok: true, receipt: { message_id: 88 } })
  const session = f.runtime.agent.persist.getSession('qq:100:group:456')
  assert.equal(session.lastText, 'second')
  assert.equal(session.messages.at(-1).text, 'second')
  assert.deepEqual(f.napcatRequests.at(-1), { path: '/send_group_msg', body: { group_id: 456, message: 'second' } })
})

test('conversation routes reject unknown accounts without touching NapCat', async (t) => {
  const f = await fixture(t)
  const response = await fetch(`${f.base}/api/runtime/im/conversations`, {
    headers: { 'x-chihiro-account': 'qq:missing' }
  })
  assert.equal(response.status, 404)
  assert.equal((await response.json()).error, 'account_not_found')
  assert.equal(f.napcatRequests.length, 0)
})
