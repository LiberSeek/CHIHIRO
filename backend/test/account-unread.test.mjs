import test from 'node:test'
import assert from 'node:assert/strict'
import { sumRecentContactUnread } from '../src/runtime/account-unread.mjs'

test('sums unique recent-contact unread counts', () => {
  assert.equal(sumRecentContactUnread([
    { peerUin: '10001', unread: 5 },
    { peerUin: '10001', unread: 2 },
    { peerUin: '20001', unread: 47 },
    { peerUin: '30001', unread: 0 },
    { peerUin: '40001' },
  ]), 52)
})

test('ignores empty or invalid recent-contact rows', () => {
  assert.equal(sumRecentContactUnread(null), 0)
  assert.equal(sumRecentContactUnread([{ peerUin: '0', unread: 9 }]), 0)
  assert.equal(sumRecentContactUnread([{ user_id: '11', unread: 1 }, { group_id: '22', unread: 3 }]), 4)
})
