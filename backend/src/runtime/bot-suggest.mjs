import { logError } from './log.mjs'
import { normalizeBotSession, sessionPeerKey } from './bot.mjs'

const SUGGEST_TIMEOUT_MS = 8000
const CACHE_TTL_MS = 30_000
const PROMPT = `你在协助操作员回复即时消息。只输出 JSON，不要 Markdown，不要自称 AI。
格式：{"replies":[{"id":"1","text":"选项","score":0.82}],"summary":"可直接发送的完整回复"}
replies：1 到 3 条不同角度、像真人会发的下一句选项，score 为 0 到 1。
summary：一条总结性、语气完整、可直接发出的回复，不要与 replies 逐字相同。`

function emptySuggest(lastMessageId = '') {
  return { lastMessageId: String(lastMessageId || ''), replies: [], summary: '' }
}

export function parseSuggestReplies(text, lastMessageId = '') {
  const trimmed = String(text || '').trim()
  if (!trimmed) return emptySuggest(lastMessageId)
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fence ? fence[1].trim() : trimmed
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return emptySuggest(lastMessageId)
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1))
    const list = Array.isArray(parsed?.replies) ? parsed.replies : Array.isArray(parsed) ? parsed : []
    const replies = []
    for (const item of list) {
      if (replies.length >= 3) break
      const textValue = typeof item?.text === 'string' ? item.text.trim() : ''
      if (!textValue) continue
      const score = Number(item?.score)
      replies.push({
        id: String(item?.id || replies.length + 1),
        text: textValue,
        score: Number.isFinite(score) ? Math.min(1, Math.max(0, score)) : 0,
      })
    }
    const summary = typeof parsed?.summary === 'string' ? parsed.summary.trim() : ''
    return { lastMessageId: String(parsed?.lastMessageId || lastMessageId || ''), replies, summary }
  } catch {
    return emptySuggest(lastMessageId)
  }
}

export function collectSsePlain(body) {
  const text = String(body || '')
  if (!text.includes('data:')) {
    try {
      const parsed = JSON.parse(text)
      if (typeof parsed?.data === 'string') return parsed.data
      if (typeof parsed?.message === 'string') return parsed.message
    } catch { /* not json */ }
    return text
  }
  const chunks = []
  for (const block of text.split(/\n\n+/)) {
    const line = block.split('\n').find((item) => item.startsWith('data:'))
    if (!line) continue
    const payload = line.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    try {
      const event = JSON.parse(payload)
      if (event?.type === 'plain' && event.data != null) chunks.push(String(event.data))
      else if (event?.type === 'end' || event?.type === 'complete') continue
      else if (typeof event?.data === 'string' && event.type !== 'session_id' && event.type !== 'user_message_saved') {
        chunks.push(event.data)
      }
    } catch {
      chunks.push(payload)
    }
  }
  return chunks.join('')
}

function clipMessages(messages) {
  if (!Array.isArray(messages)) return []
  const out = []
  for (const item of messages.slice(-20)) {
    const role = item?.role === 'me' ? 'me' : item?.role === 'them' ? 'them' : ''
    const text = typeof item?.text === 'string' ? item.text.trim() : ''
    if (!role || !text) continue
    out.push({ role, text: text.slice(0, 500) })
  }
  return out
}

function buildPrompt(messages) {
  const lines = clipMessages(messages).map((item) => `${item.role}: ${item.text}`)
  return `${PROMPT}\n\n对话：\n${lines.join('\n') || '(空)'}\n\n请给出回复建议。`
}

export function createBotSuggest({ store, qq, astrbot }) {
  const cache = new Map()

  function accountOf(id) {
    return (store.list().accounts || []).find((item) => item.id === id) || null
  }

  function sessionOf(accountId, type, peerId) {
    const acc = accountOf(accountId)
    if (!acc) return null
    return normalizeBotSession((acc.botSessions || {})[sessionPeerKey(type, peerId)])
  }

  function cacheKey(accountId, type, peerId, lastMessageId) {
    return `${accountId}:${type}:${peerId}:${lastMessageId}`
  }

  async function astrbotJson(path, { method = 'GET', body, timeout = SUGGEST_TIMEOUT_MS } = {}) {
    await astrbot.ensure()
    const token = astrbot.mintDashboardToken()
    const base = String(astrbot.url || '').replace(/\/$/, '')
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json, text/event-stream',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    })
    const text = await response.text()
    return { ok: response.ok, status: response.status, text }
  }

  function parseAstrbotList(result, keys) {
    if (!result?.ok) return []
    try {
      const parsed = JSON.parse(result.text)
      const data = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed
      for (const key of keys) {
        if (Array.isArray(data?.[key])) return data[key]
        if (Array.isArray(parsed?.[key])) return parsed[key]
      }
    } catch { /* ignore malformed payloads */ }
    return []
  }

  async function listConfigs() {
    try {
      const [configResult, sourceResult] = await Promise.all([
        astrbotJson('/api/v1/configs'),
        astrbotJson('/api/v1/provider-sources'),
      ])
      const configs = parseAstrbotList(configResult, ['configs']).flatMap((item) => {
        if (!item || typeof item.id !== 'string' || !item.id) return []
        return [{
          id: item.id,
          name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : item.id,
          isDefault: item.is_default === true || item.isDefault === true,
        }]
      })
      const sources = parseAstrbotList(sourceResult, ['provider_sources', 'providerSources'])
      return { configs, needsSetup: configs.length === 0 || sources.length === 0 }
    } catch (error) {
      logError('bot-suggest', 'configs', error)
      return { configs: [], needsSetup: true }
    }
  }

  async function suggest(body) {
    const accountId = String(body?.accountId || '')
    const type = body?.type === 'group' ? 'group' : 'private'
    const peerId = String(body?.peerId ?? '')
    const lastMessageId = String(body?.lastMessageId || '')
    const trigger = body?.trigger === 'menu' ? 'menu' : 'auto'
    const empty = emptySuggest(lastMessageId)
    if (!accountId || !peerId) return empty
    const acc = accountOf(accountId)
    if (!acc) return empty
    const inst = qq.getInstanceForAccount?.(accountId)
    if (!inst || inst.phase !== 'ready') return empty
    const session = sessionOf(accountId, type, peerId)
    if (trigger === 'auto' && !session.enabled) return empty
    if (lastMessageId) {
      const hit = cache.get(cacheKey(accountId, type, peerId, lastMessageId))
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
        return { lastMessageId, replies: hit.replies, summary: hit.summary || '' }
      }
    }
    try {
      const configId = session.configId
      const payload = {
        username: `chihiro-suggest:${accountId}`,
        session_id: `suggest:${accountId}:${type}:${peerId}`,
        message: buildPrompt(body?.messages),
        enable_streaming: false,
        flags: { enable_streaming: false },
      }
      if (configId) payload.config_id = configId
      const result = await astrbotJson('/api/v1/chat', { method: 'POST', body: payload })
      const parsed = parseSuggestReplies(collectSsePlain(result.text), lastMessageId)
      if (lastMessageId) {
        cache.set(cacheKey(accountId, type, peerId, lastMessageId), {
          at: Date.now(),
          replies: parsed.replies,
          summary: parsed.summary,
        })
      }
      return parsed
    } catch (error) {
      logError('bot-suggest', 'suggest', error)
      return empty
    }
  }

  return { suggest, listConfigs, parseSuggestReplies, sessionOf }
}
