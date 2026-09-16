import assert from 'node:assert/strict'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import test from 'node:test'
import { createRuntime } from '../src/runtime/api.mjs'
import { createBotController, normalizeBotSession } from '../src/runtime/bot.mjs'
import { parseSuggestReplies, collectSsePlain } from '../src/runtime/bot-suggest.mjs'

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return server.address().port
}

test('legacy boolean sessions normalize without enabling the adapter', () => {
  assert.deepEqual(normalizeBotSession(true), { enabled: true, mode: 'assist', configId: null })
  assert.deepEqual(normalizeBotSession(false), { enabled: false, mode: 'assist', configId: null })
  assert.deepEqual(normalizeBotSession({ enabled: true, mode: 'auto', configId: 'sales' }), {
    enabled: true, mode: 'auto', configId: 'sales',
  })
})

test('parseSuggestReplies keeps 1-3 scored texts and reads SSE plain events', () => {
  const parsed = parseSuggestReplies('```json\n{"replies":[{"id":"1","text":"好的，我买","score":0.82},{"text":"买几头？","score":0.61}],"summary":"好的，我买。"}\n```', 'm1')
  assert.equal(parsed.lastMessageId, 'm1')
  assert.equal(parsed.replies.length, 2)
  assert.equal(parsed.replies[0].text, '好的，我买')
  assert.equal(parsed.summary, '好的，我买。')
  const plain = collectSsePlain('data: {"type":"session_id","session_id":"s"}\n\ndata: {"type":"plain","data":"{\\"replies\\":[{\\"id\\":\\"1\\",\\"text\\":\\"嗯\\",\\"score\\":1}]}"}\n\n')
  assert.equal(parseSuggestReplies(plain).replies[0].text, '嗯')
})

test('setSession stores structured config and does not wire NapCat reverse', async () => {
  const account = { id: 'qq:10001', botEnabled: false, botSessions: { 'private:1': true } }
  const store = {
    list: () => ({ accounts: [account] }),
    patch(id, fields) { Object.assign(account, fields) },
  }
  let wired = 0
  const bot = createBotController({
    store,
    qq: { snapshot: () => ({ accounts: { accounts: [account] } }), touch() {}, getInstanceForAccount: () => ({ phase: 'ready' }) },
    astrbot: { ensureAdapter: async () => { wired += 1 }, ensure: async () => {}, stopIfOwned: async () => {} },
    cfg: {},
  })
  const snap = await bot.setSession('qq:10001', 'private', '20002', { enabled: true, mode: 'auto', configId: 'p' })
  assert.equal(wired, 0)
  assert.deepEqual(account.botSessions['private:20002'], { enabled: true, mode: 'auto', configId: 'p' })
  assert.deepEqual(normalizeBotSession(account.botSessions['private:1']), { enabled: true, mode: 'assist', configId: null })
  assert.equal(account.botEnabled, false)
  assert.ok(snap.accounts)
})

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'chihiro-bot-suggest-'))
  const astrbotRequests = []
  let astrbotReply = { status: 200, body: 'data: {"type":"plain","data":"{\\"replies\\":[{\\"id\\":\\"1\\",\\"text\\":\\"好的，我买\\",\\"score\\":0.82}]}"}\n\n' }
  let astrbotByPath = {}
  const astrbotServer = http.createServer((req, res) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const path = String(req.url || '').split('?')[0]
      astrbotRequests.push({
        method: req.method,
        path,
        auth: req.headers.authorization,
        body: Buffer.concat(chunks).toString(),
      })
      const reply = astrbotByPath[path] || astrbotReply
      res.writeHead(reply.status, { 'content-type': 'text/event-stream' })
      res.end(reply.body)
    })
  })
  const astrbotPort = await listen(astrbotServer)
  const box = { store: null }
  const qq = {
    snapshot: () => ({ accounts: box.store.list(), phase: 'ready' }),
    subscribe: () => () => {},
    refreshPorts: async () => {},
    getInstanceForAccount: (id) => id === 'qq:10001' ? { phase: 'ready', uin: '10001', ports: {}, tokens: {} } : null,
    touch() {},
  }
  const astrbot = {
    url: `http://127.0.0.1:${astrbotPort}`,
    ensure: async () => {},
    mintDashboardToken: () => 'dash-token',
    refreshStatus: async () => ({ running: true }),
    stopIfOwned: async () => {},
  }
  const runtime = createRuntime({
    root,
    cfg: {},
    services: { qq, astrbot, chatui: { handle: () => false } },
  })
  box.store = runtime.store
  runtime.store.upsert({ id: 'qq:10001', client: 'qq', uin: '10001' })
  const server = http.createServer(async (req, res) => {
    const handled = await runtime.handle(req, res, new URL(req.url, 'http://runtime.test'))
    if (!handled) { res.writeHead(404); res.end() }
  })
  const port = await listen(server)
  t.after(async () => {
    await runtime.shutdown()
    await Promise.all([
      new Promise((resolve) => server.close(resolve)),
      new Promise((resolve) => astrbotServer.close(resolve)),
    ])
    await rm(root, { recursive: true, force: true })
  })
  return {
    base: `http://127.0.0.1:${port}`,
    store: runtime.store,
    astrbotRequests,
    setAstrbotReply(value) { astrbotReply = value },
    setAstrbotPath(path, value) { astrbotByPath = { ...astrbotByPath, [path]: value } },
  }
}

test('auto suggest requires an enabled session; menu trigger does not', async (t) => {
  const f = await fixture(t)
  const send = (body) => fetch(`${f.base}/api/runtime/bot/suggest`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const payload = {
    accountId: 'qq:10001', type: 'private', peerId: '20002', lastMessageId: 'm1',
    messages: [{ role: 'them', text: '在吗' }],
  }
  const autoOff = await send({ ...payload, trigger: 'auto' })
  assert.equal(autoOff.status, 200)
  assert.deepEqual(await autoOff.json(), { lastMessageId: 'm1', replies: [], summary: '' })
  assert.equal(f.astrbotRequests.length, 0)

  const menu = await send({ ...payload, trigger: 'menu' })
  assert.equal(menu.status, 200)
  const menuBody = await menu.json()
  assert.equal(menuBody.replies[0].text, '好的，我买')
  assert.equal(f.astrbotRequests[0].path, '/api/v1/chat')
  assert.equal(f.astrbotRequests[0].auth, 'Bearer dash-token')
  const chatBody = JSON.parse(f.astrbotRequests[0].body)
  assert.equal(chatBody.username, 'chihiro-suggest:qq:10001')
  assert.equal(chatBody.session_id, 'suggest:qq:10001:private:20002')
  assert.equal(chatBody.enable_streaming, false)
  assert.equal(chatBody.config_id, undefined)

  await fetch(`${f.base}/api/runtime/bot/session`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'qq:10001', type: 'private', peerId: '20002', enabled: true, mode: 'assist', configId: 'sales' }),
  })
  assert.deepEqual(f.store.list().accounts[0].botSessions['private:20002'], { enabled: true, mode: 'assist', configId: 'sales' })

  const autoOn = await send({ ...payload, lastMessageId: 'm2', trigger: 'auto' })
  assert.equal((await autoOn.json()).replies[0].text, '好的，我买')
  const autoChat = JSON.parse(f.astrbotRequests.at(-1).body)
  assert.equal(autoChat.config_id, 'sales')
})

test('suggest failures return an empty list and configs proxy AstrBot', async (t) => {
  const f = await fixture(t)
  f.setAstrbotReply({ status: 500, body: 'nope' })
  const failed = await fetch(`${f.base}/api/runtime/bot/suggest`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'qq:10001', type: 'private', peerId: '1', lastMessageId: 'x', trigger: 'menu', messages: [] }),
  })
  assert.equal(failed.status, 200)
  assert.deepEqual(await failed.json(), { lastMessageId: 'x', replies: [], summary: '' })

  f.setAstrbotPath('/api/v1/configs', {
    status: 200,
    body: JSON.stringify({ status: 'ok', data: { configs: [{ id: 'default', name: '默认', path: 'a', is_default: true }] } }),
  })
  f.setAstrbotPath('/api/v1/provider-sources', {
    status: 200,
    body: JSON.stringify({ status: 'ok', data: { provider_sources: [{ id: 'openai' }] } }),
  })
  const configs = await fetch(`${f.base}/api/runtime/bot/configs`)
  assert.equal(configs.status, 200)
  assert.deepEqual(await configs.json(), {
    configs: [{ id: 'default', name: '默认', isDefault: true }],
    needsSetup: false,
  })

  f.setAstrbotPath('/api/v1/provider-sources', {
    status: 200,
    body: JSON.stringify({ status: 'ok', data: { provider_sources: [] } }),
  })
  const unconfigured = await fetch(`${f.base}/api/runtime/bot/configs`)
  assert.equal(unconfigured.status, 200)
  assert.deepEqual(await unconfigured.json(), {
    configs: [{ id: 'default', name: '默认', isDefault: true }],
    needsSetup: true,
  })
})
