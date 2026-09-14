import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveNapcatProxy, resolveOnebotWsTarget } from '../../src/gateway/napcat-routing.mjs'

test('an unknown named account never falls back to the ready or active account', () => {
  const qq = {
    getInstanceProxy: id => { assert.equal(id, 'qq:missing'); return null },
    getReadyProxy: () => assert.fail('must not consult another account'),
  }
  const fallback = () => assert.fail('must not consult active account')
  assert.equal(resolveNapcatProxy(qq, 'qq:missing', fallback), null)
  assert.equal(resolveNapcatProxy(qq, 'qq:missing', fallback, { preferReady: true }), null)
})

test('a named account keeps its exact proxy and OneBot endpoint', () => {
  const selected = { id: 'instance-A', wsPort: 5803, obToken: 'fixture-A' }
  assert.equal(resolveNapcatProxy({ getInstanceProxy: () => selected }, 'qq:A', () => null), selected)
  assert.equal(resolveOnebotWsTarget(selected, 'qq:A', 'ws://other:5801'), 'http://127.0.0.1:5803')
})

test('missing or invalid scoped WebSocket endpoints fail instead of using global config', () => {
  for (const wsPort of [undefined, null, 0, -1, 65536, 1.5, 'invalid']) {
    assert.equal(resolveOnebotWsTarget({ wsPort }, 'qq:A', 'ws://other:5801'), null)
  }
  assert.equal(resolveOnebotWsTarget(null, 'qq:A', 'ws://other:5801'), null)
})

test('unscoped legacy routes retain ready and configured fallback resolution', () => {
  const ready = { id: 'ready', wsPort: 5801 }
  const active = { id: null }
  const qq = { getReadyProxy: () => ready }
  assert.equal(resolveNapcatProxy(qq, null, () => active, { preferReady: true }), ready)
  assert.equal(resolveNapcatProxy(qq, null, () => active), active)
  assert.equal(resolveOnebotWsTarget(active, null, 'wss://example.test/onebot'), 'https://example.test/onebot')
})
