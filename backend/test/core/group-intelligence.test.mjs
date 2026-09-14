import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import test from 'node:test'

import { createGroupIntelligence } from '../../src/core/group-intelligence.mjs'

test('group intelligence creates account-scoped reports with source coverage', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'chihiro-group-intelligence-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const store = createGroupIntelligence({ root })
  const base = { accountId: 'qq:100', channel: 'qq', groupId: '300', groupName: '运营群', conversationId: 'qq:100:group:300', senderId: '200', senderName: '小林' }
  const first = store.ingest({ ...base, messageId: '1', text: '用户关注价格和交付时间', messageAt: 100 })
  assert.equal(store.ingest({ ...base, messageId: '1', text: '用户关注价格和交付时间', messageAt: 100 }).id, first.id)
  store.ingest({ ...base, groupId: '301', groupName: '客户群', conversationId: 'qq:100:group:301', messageId: '2', text: '客户希望下周安排演示', messageAt: 200 })
  store.ingest({ ...base, accountId: 'qq:101', messageId: '3', text: '另一账号消息', messageAt: 300 })

  const report = store.createReport({ title: '本周客户咨询', groupIds: ['300', '301'], from: 50, to: 250 }, { accountId: 'qq:100' })
  assert.equal(report.status, 'ready')
  assert.equal(report.coverage.sourceCount, 2)
  assert.deepEqual(report.coverage.coveredGroupIds, ['300', '301'])
  assert.equal(report.sources.length, 2)
  assert.match(report.summary, /价格和交付时间/)
  assert.equal(store.listReports({ accountId: 'qq:101' }).reports.length, 0)
  assert.throws(() => store.getReport(report.id, { accountId: 'qq:101' }), /report_not_found/)
})

test('empty report records requested scope explicitly', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'chihiro-group-intelligence-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const store = createGroupIntelligence({ root })
  const report = store.createReport({ title: '空范围', groupIds: ['404'] }, { accountId: 'qq:100' })
  assert.equal(report.status, 'draft')
  assert.deepEqual(report.coverage.requestedGroupIds, ['404'])
  assert.deepEqual(report.coverage.coveredGroupIds, [])
  assert.equal(report.coverage.sourceCount, 0)
  assert.match(report.summary, /没有已采集/)
})
