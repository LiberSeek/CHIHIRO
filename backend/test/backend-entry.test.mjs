import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('backend package exposes a runnable product entrypoint', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(backendRoot, 'package.json'), 'utf8'))
  assert.equal(packageJson.type, 'module')
  assert.equal(packageJson.scripts.start, 'node src/gateway/server.mjs')
  assert.equal(fs.existsSync(path.join(backendRoot, 'src/gateway/server.mjs')), true)
  assert.equal(fs.existsSync(path.join(backendRoot, 'src/runtime/index.mjs')), true)
})

test('backend gateway owns the product server implementation', () => {
  const source = fs.readFileSync(path.join(backendRoot, 'src/gateway/server.mjs'), 'utf8')
  assert.match(source, /createRuntime/)
  assert.doesNotMatch(source, /apps\/gateway\/src\/server\.js/)
  assert.doesNotMatch(source, /await import/)
})

test('backend runtime boundary exposes the existing lifecycle factories', async () => {
  const runtime = await import('../src/runtime/index.mjs')
  assert.equal(typeof runtime.createRuntime, 'function')
  assert.equal(typeof runtime.createQqRuntime, 'function')
  assert.equal(typeof runtime.createAstrbotRuntime, 'function')
  assert.equal(typeof runtime.createAccountStore, 'function')
})
