import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { createChatuiProxy } from '../../src/runtime/chatui.mjs'

async function listen(t, server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  return `http://127.0.0.1:${server.address().port}`
}

test('ChatUI proxy keeps POST stream alive after request body completes', { timeout: 5000 }, async t => {
  const upstream = http.createServer(async (req, res) => {
    assert.equal(req.url, '/api/v1/chat/send?session_id=preview')
    assert.equal(req.headers.authorization, 'Bearer server-only')
    let body = ''
    for await (const chunk of req) body += chunk
    assert.equal(body, '{"message":"local fixture"}')
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.write('data: first\n\n')
    setTimeout(() => res.end('data: finished\n\n'), 40)
  })
  const target = await listen(t, upstream)
  let ensured = 0
  const proxy = createChatuiProxy({ astrbot: {
    url: target, ensure: async () => { ensured++ }, mintDashboardToken: () => 'server-only',
  } })
  const gateway = http.createServer(async (req, res) => {
    if (!await proxy.handle(req, res, new URL(req.url, 'http://local'))) {
      res.writeHead(404); res.end()
    }
  })
  const base = await listen(t, gateway)
  assert.equal((await fetch(`${base}/api/runtime/chatui-other`)).status, 404)
  assert.equal(ensured, 0)
  const response = await fetch(`${base}/api/runtime/chatui/send?session_id=preview`, {
    method: 'POST', body: '{"message":"local fixture"}',
  })
  assert.equal(response.status, 200)
  assert.equal(await response.text(), 'data: first\n\ndata: finished\n\n')
})

test('closing a ChatUI response cancels its upstream stream', { timeout: 5000 }, async t => {
  let closed
  const upstreamClosed = new Promise(resolve => { closed = resolve })
  const target = await listen(t, http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.write('data: first\n\n')
    res.once('close', closed)
  }))
  const proxy = createChatuiProxy({ astrbot: {
    url: target, ensure: async () => {}, mintDashboardToken: () => 'fixture',
  } })
  const base = await listen(t, http.createServer((req, res) => {
    void proxy.handle(req, res, new URL(req.url, 'http://local'))
  }))
  await new Promise((resolve, reject) => {
    const request = http.get(`${base}/api/runtime/chatui/send`, response => {
      response.once('data', () => { response.destroy(); resolve() })
    })
    request.on('error', reject)
  })
  await upstreamClosed
})
