import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  serveLegacyStatic,
  serveProductStatic,
  redirectNextPreview
} from '../../src/gateway/static-preview.mjs'

const listen = (handler) => {
  const server = http.createServer(handler)
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      server,
      url: `http://127.0.0.1:${server.address().port}`
    }))
  })
}

test('product static serves / and /im without swallowing missing assets', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chihiro-product-'))
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><script type="module" src="/assets/app.js"></script>')
  fs.mkdirSync(path.join(root, 'assets'))
  fs.writeFileSync(path.join(root, 'assets/app.js'), 'console.log("product")')
  fs.writeFileSync(path.join(path.dirname(root), 'outside.txt'), 'private')

  const { server, url } = await listen((req, res) => {
    const requestUrl = new URL(req.url, url)
    if (redirectNextPreview(requestUrl, res)) return
    if (!serveProductStatic(root, requestUrl, res)) {
      res.writeHead(404)
      res.end('unhandled')
    }
  })
  t.after(() => {
    server.closeAllConnections()
    server.close()
    fs.rmSync(root, { recursive: true, force: true })
  })

  const home = await fetch(`${url}/`)
  assert.equal(home.status, 200)
  assert.match(await home.text(), /<script type="module"/)

  const asset = await fetch(`${url}/assets/app.js`)
  assert.equal(asset.status, 200)
  assert.match(asset.headers.get('content-type'), /javascript/)
  assert.match(asset.headers.get('cache-control'), /must-revalidate/)
  assert.equal(await asset.text(), 'console.log("product")')

  const deepLink = await fetch(`${url}/im`, { redirect: 'manual' })
  assert.equal(deepLink.status, 200)
  assert.match(await deepLink.text(), /<script type="module"/)

  const agent = await fetch(`${url}/agent`, { redirect: 'manual' })
  assert.equal(agent.status, 200)

  const missing = await fetch(`${url}/assets/missing.js`)
  assert.equal(missing.status, 404)
  assert.match(missing.headers.get('content-type'), /application\/json/)

  const traversal = await fetch(`${url}/%2e%2e/outside.txt`)
  assert.doesNotMatch(await traversal.text(), /private/)

  const api = await fetch(`${url}/api/status`)
  assert.equal(api.status, 404)
  assert.equal(await api.text(), 'unhandled')

  const nextHome = await fetch(`${url}/next/im`, { redirect: 'manual' })
  assert.equal(nextHome.status, 308)
  assert.equal(nextHome.headers.get('location'), '/im')
})

test('legacy shell is only served under /legacy', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chihiro-legacy-'))
  fs.writeFileSync(path.join(root, 'index.html'), '<title>Legacy workbench</title>')
  fs.writeFileSync(path.join(root, 'sw.js'), 'self.skipWaiting()')

  const { server, url } = await listen((req, res) => {
    const requestUrl = new URL(req.url, url)
    if (!serveLegacyStatic(root, requestUrl, res)) {
      res.writeHead(404)
      res.end('unhandled')
    }
  })
  t.after(() => {
    server.closeAllConnections()
    server.close()
    fs.rmSync(root, { recursive: true, force: true })
  })

  const rootUnhandled = await fetch(`${url}/`)
  assert.equal(rootUnhandled.status, 404)
  assert.equal(await rootUnhandled.text(), 'unhandled')

  const slash = await fetch(`${url}/legacy`, { redirect: 'manual' })
  assert.equal(slash.status, 308)
  assert.equal(slash.headers.get('location'), '/legacy/')

  const home = await fetch(`${url}/legacy/`)
  assert.equal(home.status, 200)
  assert.match(await home.text(), /Legacy workbench/)

  const worker = await fetch(`${url}/legacy/sw.js`)
  assert.equal(worker.status, 200)
  assert.equal(worker.headers.get('service-worker-allowed'), '/legacy/')
  assert.equal(worker.headers.get('cache-control'), 'no-cache')

  const missing = await fetch(`${url}/legacy/missing.js`)
  assert.equal(missing.status, 404)
})
