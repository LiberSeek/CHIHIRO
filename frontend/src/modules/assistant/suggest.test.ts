import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { accountId } from '@/contracts'
import { useShellStore } from '@/stores/shell'
import {
  useSuggestStore,
  normalizeBotSession,
  parseSuggestReplies,
  parseSuggestSummary,
  hasSubstantialText,
  highestScoreReply,
  botConversationKey,
  AUTO_SEND_MS,
  type SuggestContext,
} from './suggest'

const a: SuggestContext = { accountId: 'qq:10001', type: 'private', peerId: '20001' }
const b: SuggestContext = { ...a, accountId: 'qq:10002' }
const group: SuggestContext = { ...a, type: 'group', peerId: '30001' }
const reply = (value: unknown, ok = true) => ({ ok, json: async () => value })
const snapshot = (accountId = a.accountId, botSessions: Record<string, unknown> = {}) => ({
  accounts: { accounts: [{ id: accountId, botSessions }] },
})
const stored: Record<string, Record<string, unknown>> = {}

function sessionSnapshot(accountId: string) {
  return snapshot(accountId, stored[accountId] || {})
}

async function flush() { await new Promise(resolve => setTimeout(resolve, 0)) }

beforeEach(() => {
  setActivePinia(createPinia())
  stored[a.accountId] = {}
  stored[b.accountId] = {}
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input)
    if (url === '/api/runtime/state') return reply(sessionSnapshot(a.accountId)) as Response
    if (url === '/api/runtime/bot/session') {
      const body = JSON.parse(String(options?.body || '{}'))
      const key = `${body.type}:${body.peerId}`
      stored[body.id] = {
        ...(stored[body.id] || {}),
        [key]: { enabled: body.enabled, mode: body.mode || 'assist', configId: body.configId ?? null },
      }
      return reply(sessionSnapshot(body.id)) as Response
    }
    if (url === '/api/runtime/bot/configs') return reply({ configs: [{ id: 'default', name: '默认', isDefault: true }] }) as Response
    return reply({ lastMessageId: '', replies: [] }) as Response
  }))
  const shell = useShellStore()
  shell.accounts = [a, b].map(item => ({ id: accountId(item.accountId), label: item.accountId, platform: 'qq' as const, status: 'online' as const }))
  shell.selectAccount(accountId(a.accountId))
})
afterEach(() => {
  useSuggestStore().clear()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('normalizes legacy boolean sessions and ignores empty text', () => {
  expect(normalizeBotSession(true)).toEqual({ enabled: true, mode: 'assist', configId: null })
  expect(normalizeBotSession(false)).toEqual({ enabled: false, mode: 'assist', configId: null })
  expect(normalizeBotSession({ enabled: true, mode: 'auto', configId: 'sales' })).toEqual({
    enabled: true, mode: 'auto', configId: 'sales',
  })
  expect(parseSuggestReplies({ replies: [{ id: '1', text: ' 好的 ', score: 1.4 }, { text: '', score: 1 }, { id: 'x', text: '买几头？', score: 0.61 }] })).toEqual([
    { id: '1', text: '好的', score: 1 },
    { id: 'x', text: '买几头？', score: 0.61 },
  ])
  expect(parseSuggestSummary({ summary: ' 嗯，可以。 ' })).toBe('嗯，可以。')
  expect(parseSuggestSummary({ replies: [] })).toBe('')
  expect(hasSubstantialText('  \u200B ')).toBe(false)
  expect(highestScoreReply([{ id: '1', text: 'a', score: 0.2 }, { id: '2', text: 'b', score: 0.9 }])?.id).toBe('2')
})

it('defaults a new session to off and keeps structured config per conversation', async () => {
  const store = useSuggestStore()
  store.select(a)
  await flush()
  expect(store.enabled).toBe(false)
  expect(store.mode).toBe('assist')
  await store.setEnabled(true)
  await store.setMode('auto')
  await store.setConfigId('p')
  expect(store.enabled).toBe(true)
  expect(store.mode).toBe('auto')
  expect(JSON.parse(String(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body))).toMatchObject({
    id: a.accountId, type: 'private', peerId: '20001', enabled: true, mode: 'auto', configId: 'p',
  })
})

it('discards in-flight suggestions and chips when switching conversations', async () => {
  const store = useSuggestStore()
  store.select(a)
  await flush()
  let finish!: (value: unknown) => void
  const pendingResponse = new Promise(resolve => { finish = resolve })
  vi.mocked(fetch).mockImplementationOnce(async () => pendingResponse as unknown as Response)
  const pending = store.requestSuggest({ lastMessageId: 'm1', trigger: 'menu', messages: [{ role: 'them', text: 'hi' }] })
  expect(store.generating).toBe(true)
  store.select(group)
  await flush()
  finish(reply({ lastMessageId: 'm1', replies: [{ id: '1', text: '晚到', score: 1 }] }))
  await pending
  expect(store.replies).toEqual([])
  expect(store.generating).toBe(false)
  expect(store.lastMessageId).toBe('')
})

it('auto-requests a message id once and still allows a menu trigger', async () => {
  const store = useSuggestStore()
  store.select(a)
  await flush()
  await store.setEnabled(true)
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input)
    if (url === '/api/runtime/bot/suggest') return reply({ lastMessageId: 'm1', replies: [{ id: '1', text: '好', score: 0.8 }] }) as Response
    if (url === '/api/runtime/bot/session') {
      const body = JSON.parse(String(options?.body || '{}'))
      stored[body.id] = { ...(stored[body.id] || {}), [`${body.type}:${body.peerId}`]: { enabled: body.enabled, mode: body.mode || 'assist', configId: body.configId ?? null } }
      return reply(sessionSnapshot(body.id)) as Response
    }
    return reply(sessionSnapshot(a.accountId)) as Response
  })
  await store.requestSuggest({ lastMessageId: 'm1', trigger: 'auto', messages: [{ role: 'them', text: '在吗' }] })
  const autoCalls = vi.mocked(fetch).mock.calls.filter(call => call[0] === '/api/runtime/bot/suggest').length
  await store.requestSuggest({ lastMessageId: 'm1', trigger: 'auto', messages: [{ role: 'them', text: '在吗' }] })
  expect(vi.mocked(fetch).mock.calls.filter(call => call[0] === '/api/runtime/bot/suggest').length).toBe(autoCalls)
  await store.requestSuggest({ lastMessageId: 'm1', trigger: 'menu', messages: [{ role: 'them', text: '在吗' }] })
  expect(vi.mocked(fetch).mock.calls.filter(call => call[0] === '/api/runtime/bot/suggest').length).toBe(autoCalls + 1)
  expect(store.replies[0].text).toBe('好')
})

it('cancels auto-send when the operator types and does not send leftover text', async () => {
  const store = useSuggestStore()
  const sent: string[] = []
  let input = ''
  store.bindActions({ fill: text => { input = text }, send: text => { sent.push(text) }, inputText: () => input })
  store.select(a)
  await flush()
  await store.setEnabled(true)
  await store.setMode('auto')
  vi.mocked(fetch).mockResolvedValueOnce(reply({
    lastMessageId: 'm2',
    replies: [{ id: '1', text: '好的，我买', score: 0.82 }, { id: '2', text: '买几头？', score: 0.61 }],
  }) as Response)
  vi.useFakeTimers()
  await store.requestSuggest({ lastMessageId: 'm2', trigger: 'menu', messages: [{ role: 'them', text: '买吗' }] })
  expect(store.highlightedId).toBe('1')
  expect(store.countingDown).toBe(true)
  input = '我自己回'
  store.onOperatorInput()
  await vi.advanceTimersByTimeAsync(AUTO_SEND_MS + 50)
  expect(sent).toEqual([])
  expect(botConversationKey(a)).toBe('qq:10001:private:20001')
})

it('stores bubble options and a separate composer summary', async () => {
  const store = useSuggestStore()
  store.select(a)
  await flush()
  vi.mocked(fetch).mockResolvedValueOnce(reply({
    lastMessageId: 'm4',
    replies: [{ id: '1', text: '还没用过，你觉得呢？', score: 0.8 }, { id: '2', text: '听起来挺有意思', score: 0.6 }],
    summary: '我觉得还不错，刚开始用。',
  }) as Response)
  await store.requestSuggest({ lastMessageId: 'm4', trigger: 'menu', messages: [{ role: 'them', text: '怎么样' }] })
  expect(store.replies.map(item => item.text)).toEqual(['还没用过，你觉得呢？', '听起来挺有意思'])
  expect(store.summary).toBe('我觉得还不错，刚开始用。')
  expect(store.composerReply?.text).toBe('我觉得还不错，刚开始用。')
})

it('marks empty or failed AstrBot configs as needing workbench model setup', async () => {
  const store = useSuggestStore()
  expect(store.configsReady).toBe(false)
  expect(store.needsAstrBotSetup).toBe(false)
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
    if (String(input) === '/api/runtime/bot/configs') return reply({ configs: [] }) as Response
    return reply(sessionSnapshot(a.accountId)) as Response
  })
  await store.loadConfigs()
  expect(store.configsReady).toBe(true)
  expect(store.needsAstrBotSetup).toBe(true)
  store.clear()
  expect(store.configsReady).toBe(false)
  expect(store.needsAstrBotSetup).toBe(false)
  vi.mocked(fetch).mockRejectedValueOnce(new Error('down'))
  await store.loadConfigs()
  expect(store.configs).toEqual([])
  expect(store.needsAstrBotSetup).toBe(true)
})

it('does not treat an unspecified session config as missing AstrBot setup', async () => {
  const store = useSuggestStore()
  await store.loadConfigs()
  expect(store.configs).toEqual([{ id: 'default', name: '默认', isDefault: true }])
  expect(store.needsAstrBotSetup).toBe(false)
  expect(store.selectedConfigLabel).toBe('未指定')
})

it('still needs workbench model setup when AstrBot only has a default config', async () => {
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
    if (String(input) === '/api/runtime/bot/configs') {
      return reply({
        configs: [{ id: 'default', name: 'default', isDefault: true }],
        needsSetup: true,
      }) as Response
    }
    return reply(sessionSnapshot(a.accountId)) as Response
  })
  const store = useSuggestStore()
  await store.loadConfigs()
  expect(store.configs).toHaveLength(1)
  expect(store.needsAstrBotSetup).toBe(true)
})

it('sends a chip immediately even if the composer already has text', async () => {
  const store = useSuggestStore()
  const sent: string[] = []
  store.bindActions({ fill: () => {}, send: (text, force) => { if (force) sent.push(text) }, inputText: () => '草稿' })
  store.select(a)
  await flush()
  store.sendReply({ id: '1', text: '直接发出去', score: 1 })
  expect(sent).toEqual(['直接发出去'])
})

it('auto-sends the highest score reply after 5s when the input stays empty', async () => {
  const store = useSuggestStore()
  const sent: string[] = []
  store.bindActions({ fill: () => {}, send: text => { sent.push(text) }, inputText: () => '' })
  store.select(a)
  await flush()
  await store.setEnabled(true)
  await store.setMode('auto')
  vi.mocked(fetch).mockResolvedValueOnce(reply({
    lastMessageId: 'm3',
    replies: [{ id: '1', text: '好的，我买', score: 0.82 }, { id: '2', text: '买几头？', score: 0.61 }],
  }) as Response)
  vi.useFakeTimers()
  await store.requestSuggest({ lastMessageId: 'm3', trigger: 'menu', messages: [{ role: 'them', text: '买吗' }] })
  expect(store.countingDown).toBe(true)
  await vi.advanceTimersByTimeAsync(AUTO_SEND_MS + 50)
  expect(sent).toEqual(['好的，我买'])
  expect(store.replies).toEqual([])
})
