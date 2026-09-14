import assert from 'node:assert/strict'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import test from 'node:test'

import { createRuntime } from '../src/runtime/api.mjs'

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'chihiro-runtime-group-intelligence-'))
  const qq = { snapshot: () => ({ accounts: { accounts: [] } }), subscribe: () => () => {}, refreshPorts: async () => {} }
  const astrbot = { refreshStatus: async () => ({}), stopIfOwned: async () => {} }
  const bot = { wired: new Set(), sync: async () => {}, unwireBeforeRemove: async () => {} }
  const runtime = createRuntime({ root, cfg: {}, services: { qq, astrbot, bot, chatui: { handle: () => false } } })
  const server = http.createServer(async (req, res) => {
    if (!await runtime.handle(req, res, new URL(req.url, 'http://runtime.test'))) { res.writeHead(404); res.end() }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    await runtime.shutdown()
    await new Promise((resolve) => server.close(resolve))
    await rm(root, { recursive: true, force: true })
  })
  return `http://127.0.0.1:${server.address().port}`
}

async function jsonRequest(url, method, accountId, body) {
  return fetch(url, {
    method,
    headers: { 'content-type': 'application/json', ...(accountId ? { 'x-chihiro-account': accountId } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

test('runtime group intelligence endpoints retain evidence and account scope', async (t) => {
  const base = await fixture(t)
  const message = {
    accountId: 'qq:100', groupId: '300', groupName: '运营群', conversationId: 'qq:100:group:300',
    messageId: '1', senderId: '200', text: '客户询问企业套餐价格', messageAt: 100,
  }
  const ingested = await jsonRequest(`${base}/api/runtime/group-intelligence/messages/ingest`, 'POST', 'qq:100', message)
  assert.equal(ingested.status, 200)
  const reportResponse = await jsonRequest(`${base}/api/runtime/group-intelligence/reports`, 'POST', 'qq:100', { title: '咨询汇总', groupIds: ['300'] })
  assert.equal(reportResponse.status, 200)
  const report = await reportResponse.json()
  assert.equal(report.coverage.sourceCount, 1)
  assert.equal(report.sources[0].messageId, '1')

  const listed = await fetch(`${base}/api/runtime/group-intelligence/reports`, { headers: { 'x-chihiro-account': 'qq:100' } })
  assert.deepEqual((await listed.json()).reports.map((item) => item.id), [report.id])
  const hidden = await fetch(`${base}/api/runtime/group-intelligence/reports/${report.id}`, { headers: { 'x-chihiro-account': 'qq:101' } })
  assert.equal(hidden.status, 404)
  const mismatch = await jsonRequest(`${base}/api/runtime/group-intelligence/messages/ingest`, 'POST', 'qq:101', message)
  assert.equal(mismatch.status, 400)
  assert.equal((await mismatch.json()).error, 'account_mismatch')
})

test('runtime report creation requires an explicit account', async (t) => {
  const base = await fixture(t)
  const response = await jsonRequest(`${base}/api/runtime/group-intelligence/reports`, 'POST', '', { title: '无账号报告' })
  assert.equal(response.status, 400)
  assert.equal((await response.json()).error, 'missing_account')
})
