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
    name: 'list_accounts',
    description: 'List Chihiro QQ accounts (online, bot enabled, pending drafts).',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'list_sessions',
    description: 'List Agentic Bot sessions for an account (all peers the bot has handled).',
    inputSchema: {
      type: 'object',
      properties: { accountId: { type: 'string', description: 'qq:<uin>' } },
      required: ['accountId']
    }
  },
  {
    name: 'get_session',
    description: 'Get one session thread including messages and pending drafts.',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        peerId: { type: 'string' },
        type: { type: 'string', enum: ['private', 'group'] },
        key: { type: 'string' }
      }
    }
  },
  {
    name: 'set_mode',
    description: 'Set reply permission: ask (hold every reply), auto (send text, hold sensitive), always (send). Omit peerId to set account default.',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        peerId: { type: 'string' },
        type: { type: 'string' },
        mode: { type: 'string', enum: ['ask', 'auto', 'always'] }
      },
      required: ['accountId', 'mode']
    }
  },
  {
    name: 'list_drafts',
    description: 'Pending Bot replies waiting for human approval.',
    inputSchema: {
      type: 'object',
      properties: { accountId: { type: 'string' } },
      required: ['accountId']
    }
  },
  {
    name: 'approve_draft',
    description: 'Send a held Bot draft to the QQ peer.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id']
    }
  },
  {
    name: 'discard_draft',
    description: 'Drop a held Bot draft without sending.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id']
    }
  },
  {
    name: 'ask_bot',
    description: 'Operator-only instruction to AstrBot for this peer. Never sent to the QQ user. Reply is held as a draft.',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        peerId: { type: 'string' },
        type: { type: 'string' },
        text: { type: 'string' },
        quote: { type: 'string', description: 'Optional quoted session text' }
      },
      required: ['accountId', 'peerId', 'text']
    }
  },
  {
    name: 'send_to_peer',
    description: 'Send a message to the QQ peer as this account (human send).',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        peerId: { type: 'string' },
        type: { type: 'string' },
        text: { type: 'string' }
      },
      required: ['accountId', 'peerId', 'text']
    }
  }
]

async function callTool(name, args = {}) {
  switch (name) {
    case 'list_accounts': {
      const snap = await api('GET', '/api/runtime/state')
      const pending = snap.agent?.pendingByAccount || {}
      return (snap.accounts?.accounts || []).map((a) => ({
        id: a.id,
        uin: a.uin,
        nickname: a.nickname,
        online: a.online,
        botEnabled: a.botEnabled,
        pendingDrafts: pending[a.id] || 0
      }))
    }
    case 'list_sessions':
      return (await api('GET', `/api/runtime/agent/sessions?accountId=${encodeURIComponent(args.accountId)}`)).sessions
    case 'get_session': {
      const q = new URLSearchParams()
      if (args.key) q.set('key', args.key)
      if (args.accountId) q.set('accountId', args.accountId)
      if (args.peerId) q.set('peerId', args.peerId)
      if (args.type) q.set('type', args.type)
      return api('GET', `/api/runtime/agent/session?${q}`)
    }
    case 'set_mode':
      return api('POST', '/api/runtime/agent/mode', args)
    case 'list_drafts':
      return (await api('GET', `/api/runtime/agent/state?accountId=${encodeURIComponent(args.accountId)}`)).drafts
    case 'approve_draft':
      return api('POST', '/api/runtime/agent/draft/approve', { id: args.id })
    case 'discard_draft':
      return api('POST', '/api/runtime/agent/draft/discard', { id: args.id })
    case 'ask_bot':
      return api('POST', '/api/runtime/agent/ask', args)
    case 'send_to_peer':
      return api('POST', '/api/runtime/agent/send', args)
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
        serverInfo: { name: 'chihiro', version: '0.1.0' }
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
