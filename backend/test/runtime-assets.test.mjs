import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { clonePaths } from '../src/runtime/qq-clone.mjs'

test('runtime clone assets resolve inside moved backend runtime source', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chihiro-runtime-assets-'))
  try {
    const paths = clonePaths(root)
    assert.equal(paths.runtimes, path.join(root, 'data/runtimes'))
    assert.equal(paths.app, path.join(root, 'data/runtimes/QQ.app'))
    assert.equal(fs.existsSync(paths.entitlements), true)
    assert.equal(fs.existsSync(paths.icon), true)
    assert.match(paths.entitlements, /backend\/src\/runtime\/qq\.entitlements\.plist$/)
    assert.match(paths.icon, /backend\/src\/runtime\/icon\.icns$/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
