import test from 'node:test'
import assert from 'node:assert/strict'
import { parseProcessRows } from '../src/runtime/qq-napcat.mjs'

test('process listing prefers Linux-compatible ps flags before BSD flags', () => {
  const calls = []
  const rows = parseProcessRows((command, args) => {
    calls.push([command, ...args])
    assert.deepEqual(args, ['-eo', 'pid=,command='])
    return '    1 node backend/src/gateway/server.mjs\n  42 /Applications/QQ.app/Contents/MacOS/QQ --no-sandbox\n'
  })

  assert.deepEqual(calls, [['ps', '-eo', 'pid=,command=']])
  assert.deepEqual(rows, [
    { pid: 1, cmd: 'node backend/src/gateway/server.mjs' },
    { pid: 42, cmd: '/Applications/QQ.app/Contents/MacOS/QQ --no-sandbox' },
  ])
})

test('process listing falls back across ps dialects without logging container errors', () => {
  const calls = []
  const rows = parseProcessRows((_command, args) => {
    calls.push(args)
    if (calls.length === 1) throw new Error('unsupported command column')
    if (calls.length === 2) return '7 /usr/bin/node server.mjs\n'
    throw new Error('must not reach BSD fallback')
  })

  assert.deepEqual(calls, [
    ['-eo', 'pid=,command='],
    ['-eo', 'pid=,args='],
  ])
  assert.deepEqual(rows, [{ pid: 7, cmd: '/usr/bin/node server.mjs' }])
})

test('process listing returns an empty set when no ps dialect is available', () => {
  const rows = parseProcessRows(() => { throw new Error('ps unavailable') })
  assert.deepEqual(rows, [])
})
