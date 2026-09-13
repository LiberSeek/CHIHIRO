import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createAstrbotRuntime } from '../src/runtime/astrbot.mjs'

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${server.address().port}`
}

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chihiro-astrbot-external-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  return root
}

function assertNoLocalMutation(root) {
  assert.equal(fs.existsSync(path.join(root, 'config/chihiro.local.json')), false)
  assert.equal(fs.existsSync(path.join(root, 'data/astrbot')), false)
  assert.equal(fs.existsSync(path.join(root, 'data/logs/astrbot.log')), false)
}

test('external mode probes configured URL and never creates local AstrBot files', async (t) => {
  let probes = 0
  const server = http.createServer((req, res) => {
    probes += 1
    assert.equal(req.method, 'GET')
    assert.equal(req.url, '/')
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('external astrbot')
  })
  const url = await listen(server)
  t.after(() => {
    server.closeAllConnections()
    server.close()
  })
  const root = tempRoot(t)
  const runtime = createAstrbotRuntime({
    root,
    cfg: { astrbot: { mode: 'external', url } }
  })

  assert.equal(runtime.status().running, false)
  const ensured = await runtime.ensure()
  assert.equal(ensured.mode, 'external')
  assert.equal(ensured.running, true)
  assert.equal(ensured.owned, false)
  assert.equal(ensured.pid, null)
  assert.equal(ensured.url, url)
  assert.equal(probes, 1)
  assertNoLocalMutation(root)

  const stopped = await runtime.stopIfOwned()
  assert.equal(stopped.running, true)
  assert.equal(stopped.owned, false)
  assert.equal(probes, 2)
  assertNoLocalMutation(root)
})

test('external mode reports unavailable remote without spawning or writing local config', async (t) => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200)
    res.end('late')
  })
  const url = await listen(server)
  await new Promise((resolve) => server.close(resolve))
  const root = tempRoot(t)
  const runtime = createAstrbotRuntime({
    root,
    cfg: { astrbot: { mode: 'external', url } }
  })

  await assert.rejects(runtime.ensure(), /外部 AstrBot 不可用/)
  const status = runtime.status()
  assert.equal(status.mode, 'external')
  assert.equal(status.running, false)
  assert.equal(status.owned, false)
  assert.equal(status.pid, null)
  assert.match(status.error, /外部 AstrBot 不可用/)
  assertNoLocalMutation(root)
})

test('external dashboard token comes only from backend environment and is not exposed in status', async (t) => {
  const server = http.createServer((_req, res) => {
    res.writeHead(401)
    res.end('auth required')
  })
  const url = await listen(server)
  t.after(() => {
    server.closeAllConnections()
    server.close()
  })
  const root = tempRoot(t)
  const envName = 'CHIHIRO_TEST_ASTRBOT_TOKEN'
  const previous = process.env[envName]
  process.env[envName] = 'server-secret-token'
  t.after(() => {
    if (previous === undefined) delete process.env[envName]
    else process.env[envName] = previous
  })

  const runtime = createAstrbotRuntime({
    root,
    cfg: { astrbot: { mode: 'external', url, dashboardTokenEnv: envName } }
  })

  assert.equal(runtime.mintDashboardToken(), 'server-secret-token')
  const status = await runtime.refreshStatus()
  assert.equal(status.running, true)
  assert.equal(status.statusCode, 401)
  assert.doesNotMatch(JSON.stringify(status), /server-secret-token/)
  assertNoLocalMutation(root)
})

test('external reverse adapter requires explicit per-account configuration', async (t) => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200)
    res.end('ok')
  })
  const url = await listen(server)
  t.after(() => {
    server.closeAllConnections()
    server.close()
  })
  const root = tempRoot(t)
  const runtime = createAstrbotRuntime({
    root,
    cfg: { astrbot: { mode: 'external', url } }
  })

  await assert.rejects(
    runtime.ensureAdapter({ uin: '10001', reversePort: 13001 }),
    /未配置账号 10001 的反向 OneBot 地址/
  )
  await assert.rejects(
    runtime.reverseEndpoint('10001', 13001),
    /未配置账号 10001 的反向 OneBot 地址/
  )
  assertNoLocalMutation(root)
})

test('external reverse adapter returns explicit account mapping without local mutation', async (t) => {
  const server = http.createServer((_req, res) => {
    res.writeHead(403)
    res.end('forbidden but reachable')
  })
  const url = await listen(server)
  t.after(() => {
    server.closeAllConnections()
    server.close()
  })
  const root = tempRoot(t)
  const runtime = createAstrbotRuntime({
    root,
    cfg: {
      astrbot: {
        mode: 'external',
        url,
        accounts: {
          '10001': {
            reverse: {
              id: 'remote-qq-10001',
              url: 'ws://astrbot.example/ws/10001',
              host: 'astrbot.example',
              port: 19001,
              token: 'reverse-secret'
            }
          }
        }
      }
    }
  })

  const adapter = await runtime.ensureAdapter({ uin: '10001', reversePort: 13001 })
  assert.deepEqual(adapter, {
    id: 'remote-qq-10001',
    url: 'ws://astrbot.example/ws/10001',
    host: 'astrbot.example',
    port: 19001,
    token: 'reverse-secret'
  })
  assert.deepEqual(await runtime.reverseEndpoint('10001'), adapter)
  assertNoLocalMutation(root)
})

test('local adopted AstrBot listener is not killed when adapter reload is needed', async (t) => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200)
    res.end('adopted local service')
  })
  const url = await listen(server)
  t.after(() => {
    server.closeAllConnections()
    server.close()
  })
  const port = new URL(url).port
  const root = tempRoot(t)
  const runtime = createAstrbotRuntime({
    root,
    cfg: {
      astrbot: {
        url,
        host: '127.0.0.1',
        port,
        dataDir: 'data/astrbot'
      }
    }
  })

  const originalKill = process.kill
  let killed = false
  process.kill = (...args) => {
    killed = true
    return originalKill(...args)
  }
  t.after(() => { process.kill = originalKill })

  await assert.rejects(
    runtime.ensureAdapter({ uin: '10001', reversePort: 13101 }),
    /不是千寻启动的进程/
  )
  assert.equal(killed, false)
})
