#!/usr/bin/env node
/**
 * Chihiro MCP — stdio JSON-RPC for Codex / Claude.
 * Talks to the local workbench: http://127.0.0.1:3100
 *
 * Claude Desktop / Codex extra:
 *   { "mcpServers": { "chihiro": { "command": "node", "args": ["/abs/path/apps/mcp/server.mjs"] } } }
 */
import { stdin, stdout } from 'node:process'

const BASE = process.env.CHIHIRO_URL || 'http://127.0.0.1:3100'

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`)
  return json
}

const tools = [
  {
    name: 'observe',
    description:
      'Look at Chihiro/QQ. kind=accounts|sessions|session|messages|drafts|friends|groups|members. ' +
      'session/messages bridge live QQ history (NapCat) for a private or group peer — does not require prior agent tracking. ' +
      'Codex loops this instead of a task queue.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['accounts', 'sessions', 'session', 'messages', 'history', 'drafts', 'friends', 'groups', 'members']
        },
        accountId: { type: 'string', description: 'qq:<uin>, required except kind=accounts' },
        peerId: { type: 'string', description: 'friend uin or group id for session/messages' },
        type: { type: 'string', enum: ['private', 'group'] },
        key: { type: 'string' },
        groupId: { type: 'string', description: 'required for kind=members; also accepted as peer for group session' },
        count: { type: 'number', description: 'history size for session/messages (default 30, max 100)' }
      }
    }
  },
  {
    name: 'send',
    description: 'Send to a QQ peer as this account. Goes through Chihiro, not AstrBot. Optional image is a local path or URL Codex already made.',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        peerId: { type: 'string' },
        type: { type: 'string', enum: ['private', 'group'] },
        text: { type: 'string' },
        image: { type: 'string' }
      },
      required: ['accountId', 'peerId']
    }
  },
  {
    name: 'gate',
    description: 'Human gate: set reply mode, approve a draft, or discard it. mode=ask|auto|always. Add-friend is not automated.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['mode', 'approve', 'discard'] },
        accountId: { type: 'string' },
        peerId: { type: 'string' },
        type: { type: 'string' },
        mode: { type: 'string', enum: ['ask', 'auto', 'always'] },
        id: { type: 'string', description: 'draft id for approve/discard' }
      },
      required: ['action']
    }
  }
]

async function callTool(name, args = {}) {
  switch (name) {
    case 'observe': {
      const q = new URLSearchParams()
      q.set('kind', args.kind || 'accounts')
      if (args.accountId) q.set('accountId', args.accountId)
      if (args.peerId) q.set('peerId', args.peerId)
      if (args.type) q.set('type', args.type)
      if (args.key) q.set('key', args.key)
      if (args.groupId) q.set('groupId', args.groupId)
      if (args.count != null && args.count !== '') q.set('count', String(args.count))
      return api('GET', `/api/runtime/agent/observe?${q}`)
    }
    case 'send':
      return api('POST', '/api/runtime/agent/send', { ...args, type: args.type || 'private' })
    case 'gate': {
      const action = args.action
      if (action === 'mode') {
        if (!args.accountId || !args.mode) throw new Error('mode 需要 accountId 和 mode')
        return api('POST', '/api/runtime/agent/mode', args)
      }
      if (action === 'approve') {
        if (!args.id) throw new Error('approve 需要草稿 id')
        return api('POST', '/api/runtime/agent/draft/approve', { id: args.id })
      }
      if (action === 'discard') {
        if (!args.id) throw new Error('discard 需要草稿 id')
        return api('POST', '/api/runtime/agent/draft/discard', { id: args.id })
      }
      throw new Error('unknown_gate_action')
    }
    default:
      throw new Error(`unknown tool ${name}`)
  }
}

function write(msg) {
  const json = JSON.stringify(msg)
  const buf = Buffer.from(json, 'utf8')
  const head = Buffer.alloc(4)
  // MCP stdio uses Content-Length headers (LSP style), not raw JSON lines.
  stdout.write(`Content-Length: ${buf.length}\r\n\r\n`)
  stdout.write(buf)
}

let buf = Buffer.alloc(0)
stdin.on('data', (chunk) => {
  buf = Buffer.concat([buf, chunk])
  while (true) {
    const headerEnd = buf.indexOf('\r\n\r\n')
    if (headerEnd < 0) break
    const header = buf.slice(0, headerEnd).toString('utf8')
    const match = header.match(/Content-Length:\s*(\d+)/i)
    if (!match) {
      buf = buf.slice(headerEnd + 4)
      continue
    }
    const len = Number(match[1])
    const start = headerEnd + 4
    if (buf.length < start + len) break
    const body = buf.slice(start, start + len).toString('utf8')
    buf = buf.slice(start + len)
    handle(body).catch((e) => {
      write({ jsonrpc: '2.0', error: { code: -32603, message: e.message }, id: null })
    })
  }
})

async function handle(raw) {
  const msg = JSON.parse(raw)
  const { id, method, params } = msg
  if (method === 'initialize') {
    write({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: params?.protocolVersion || '2024-11-05',
        capabilities: { tools: {} },
        instructions:
          'Chihiro QQ hands. Tools: observe, send, gate. ' +
          'Use observe kind=session|messages with peerId+type to read live QQ chat history (bridged). ' +
          'Do not invent accountId/peerId. Ask the user before send or gate.approve. Do not add friends. ' +
          'Image generation is your job; send.image only delivers a file you already have.',
        serverInfo: { name: 'chihiro', version: '0.2.0' }
      }
    })
    return
  }
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') return
  if (method === 'tools/list') {
    write({ jsonrpc: '2.0', id, result: { tools } })
    return
  }
  if (method === 'tools/call') {
    try {
      const result = await callTool(params.name, params.arguments || {})
      write({
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      })
    } catch (e) {
      write({
        jsonrpc: '2.0',
        id,
        result: { isError: true, content: [{ type: 'text', text: e.message }] }
      })
    }
    return
  }
  if (method === 'ping') {
    write({ jsonrpc: '2.0', id, result: {} })
    return
  }
  write({ jsonrpc: '2.0', id, error: { code: -32601, message: `unknown method ${method}` } })
}

stdin.resume()
