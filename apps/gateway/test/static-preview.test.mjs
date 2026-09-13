import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { serveLegacyStatic, serveNextPreviewStatic } from '../src/static-preview.mjs'

const listen = (handler) => {
  const server = http.createServer(handler)
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      server,
      url: `http://127.0.0.1:${server.address().port}`
    }))
  })
}

test('preview serves assets and deep links under /next without swallowing missing assets', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chihiro-next-'))
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><script type="module" src="/next/assets/app.js"></script>')
  fs.mkdirSync(path.join(root, 'assets'))
  fs.writeFileSync(path.join(root, 'assets/app.js'), 'console.log("preview")')
  fs.writeFileSync(path.join(root, 'secret.txt'), 'private')

  const { server, url } = await listen((req, res) => {
    const requestUrl = new URL(req.url, url)
    if (!serveNextPreviewStatic(root, requestUrl, res)) {
      res.writeHead(404)
      res.end('unhandled')
    }
  })
  t.after(() => {
    server.closeAllConnections()
    server.close()
    fs.rmSync(root, { recursive: true, force: true })
  })

  const asset = await fetch(`${url}/next/assets/app.js`)
  assert.equal(asset.status, 200)
  assert.match(asset.headers.get('content-type'), /javascript/)
  assert.match(asset.headers.get('cache-control'), /must-revalidate/)
  assert.equal(await asset.text(), 'console.log("preview")')

  const deepLink = await fetch(`${url}/next/agent`, { redirect: 'manual' })
  assert.equal(deepLink.status, 200)
  assert.match(await deepLink.text(), /<script type="module"/)

  const missing = await fetch(`${url}/next/assets/missing.js`)
  assert.equal(missing.status, 404)
  assert.match(missing.headers.get('content-type'), /application\/json/)

  const traversal = await fetch(`${url}/next/%2e%2e/secret.txt`)
  assert.equal(traversal.status, 404)
  assert.doesNotMatch(await traversal.text(), /private/)

  const outside = await fetch(`${url}/next/%2e%2e%2fsecret.txt`)
  assert.equal(outside.status, 404)
})

test('legacy root remains apps/web and keeps its static HTTP semantics', async (t) => {
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

  const home = await fetch(`${url}/`)
  assert.equal(home.status, 200)
  assert.match(await home.text(), /Legacy workbench/)

  const worker = await fetch(`${url}/sw.js`)
  assert.equal(worker.status, 200)
  assert.equal(worker.headers.get('service-worker-allowed'), '/')
  assert.equal(worker.headers.get('cache-control'), 'no-cache')

  const missing = await fetch(`${url}/missing.js`)
  assert.equal(missing.status, 404)
})
