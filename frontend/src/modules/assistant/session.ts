import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { z } from 'zod'
import { useShellStore } from '@/stores/shell'

export interface AssistantContext {
  accountId: string
  type: 'private' | 'group'
  peerId: string
  title: string
}
export type AssistantMode = 'ask' | 'auto' | 'always'
const messageSchema = z.object({
  id: z.string(), role: z.string(), text: z.string().optional(), status: z.string().optional(),
  steps: z.array(z.object({ title: z.string(), detail: z.string().optional() })).optional(),
})
const sessionSchema = z.object({
  key: z.string(), accountId: z.string(), type: z.enum(['private', 'group']), peerId: z.string(),
  title: z.string().optional(), mode: z.enum(['ask', 'auto', 'always']),
  assistHold: z.boolean().optional(),
  messages: z.array(messageSchema).default([]),
})
const draftSchema = z.object({
  id: z.string(), accountId: z.string(), sessionKey: z.string(),
  type: z.enum(['private', 'group']), peerId: z.string(), text: z.string(), status: z.string(),
})
const snapshotSchema = z.object({ sessions: z.array(sessionSchema), drafts: z.array(draftSchema), recentDrafts: z.array(draftSchema).optional() })
export type AssistantDraft = z.infer<typeof draftSchema>
export function assistantKey(context: AssistantContext): string {
  return `${context.accountId}:${context.type}:${context.peerId}`
}

export const useAssistantStore = defineStore('conversation-assistant', () => {
  const shell = useShellStore()
  const context = ref<AssistantContext | null>(null)
  const sessions = ref<z.infer<typeof sessionSchema>[]>([])
  const drafts = ref<AssistantDraft[]>([])
  const hosted = ref<Record<string, boolean>>({})
  const open = ref(false)
  const quote = ref('')
  const instruction = ref('')
  const error = ref('')
  const busy = ref(false)
  const connected = ref(false)
  const uncertainDrafts = ref<string[]>([])
  let generation = 0
  let stream: EventSource | undefined
  let controller: AbortController | undefined
  const key = computed(() => context.value ? assistantKey(context.value) : '')
  const session = computed(() => sessions.value.find(item => item.key === key.value))
  const currentDrafts = computed(() => drafts.value.filter(item => item.sessionKey === key.value))
  const enabled = computed(() => Boolean(hosted.value[key.value]))
  const thinking = computed(() => [...(session.value?.messages ?? [])].reverse().find(item => item.role === 'thinking'))
  const thinkingText = computed(() => thinking.value?.steps?.map(step => [step.title, step.detail].filter(Boolean).join(': ')).join('\n') || thinking.value?.text || '')

  function acceptSnapshot(value: unknown, accountId: string) {
    const parsed = snapshotSchema.parse(value)
    sessions.value = parsed.sessions.filter(item => item.accountId === accountId && item.key === assistantKey({ ...item, title: item.title ?? '' }))
    drafts.value = (parsed.recentDrafts ?? parsed.drafts).filter(item => item.accountId === accountId && item.sessionKey === assistantKey({ ...item, title: '' }))
    uncertainDrafts.value = uncertainDrafts.value.filter(id => drafts.value.some(item => item.id === id && item.status === 'pending'))
  }

  async function request(path: string, body?: unknown, signal?: AbortSignal): Promise<unknown> {
    signal?.throwIfAborted()
    const response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST', cache: 'no-store', signal,
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`)
    return data
  }

  function applyHosted(value: unknown, accountId: string) {
    const schema = z.object({ accounts: z.object({ accounts: z.array(z.object({
      id: z.string(), botSessions: z.record(z.string(), z.boolean()).optional(),
    })) }) })
    const account = schema.parse(value).accounts.accounts.find(item => item.id === accountId)
    hosted.value = Object.fromEntries(Object.entries(account?.botSessions ?? {}).map(([id, value]) => [`${accountId}:${id}`, value]))
  }

  async function start(accountId: string) {
    const version = ++generation
    stream?.close()
    controller?.abort()
    controller = new AbortController()
    sessions.value = []
    drafts.value = []
    hosted.value = {}
    uncertainDrafts.value = []
    error.value = ''
    busy.value = false
    connected.value = false
    const signal = controller.signal
    try {
      const state = await request('/api/runtime/state', undefined, signal)
      if (version !== generation) return
      applyHosted(state, accountId)
      stream = new EventSource(`/api/runtime/agent/stream?accountId=${encodeURIComponent(accountId)}`)
      stream.onmessage = event => {
        if (version !== generation) return
        try { acceptSnapshot(JSON.parse(event.data), accountId); connected.value = true; error.value = '' }
        catch { error.value = '助手状态响应格式无效'; connected.value = false }
      }
      stream.onerror = () => {
        if (version === generation) { connected.value = false; error.value = '助手连接中断，正在重连' }
      }
    } catch (cause) {
      if (version === generation) error.value = cause instanceof Error ? cause.message : String(cause)
    }
  }

  function select(next: AssistantContext) {
    if (next.accountId !== shell.activeAccountId || !/^\d+$/.test(next.peerId)) return
    if (key.value !== assistantKey(next)) {
      quote.value = ''; instruction.value = ''; open.value = false
      context.value = { ...next }
      void start(next.accountId)
    } else context.value = { ...next }
  }

  function clear() {
    ++generation
    stream?.close(); stream = undefined
    controller?.abort(); controller = undefined
    context.value = null; sessions.value = []; drafts.value = []; hosted.value = {}
    uncertainDrafts.value = []
    open.value = false; quote.value = ''; instruction.value = ''; busy.value = false
    error.value = ''; connected.value = false
  }

  async function run(action: (target: AssistantContext, signal: AbortSignal) => Promise<void>) {
    if (!context.value || busy.value || !controller) return
    const target = { ...context.value }
    const version = generation
    busy.value = true; error.value = ''
    try { await action(target, controller.signal) }
    catch (cause) { if (version === generation) error.value = cause instanceof Error ? cause.message : String(cause) }
    finally { if (version === generation) busy.value = false }
  }

  async function setHosting(value: boolean, mode: AssistantMode = 'ask') {
    await run(async (target, signal) => {
      if (value) await request('/api/runtime/agent/mode', { ...target, mode }, signal)
      else {
        const result = await request('/api/runtime/agent/takeover', target, signal)
        if (!signal.aborted) acceptSnapshot(result, target.accountId)
      }
      const result = await request('/api/runtime/bot/session', { id: target.accountId, type: target.type, peerId: target.peerId, enabled: value }, signal)
      if (!signal.aborted) applyHosted(result, target.accountId)
    })
  }

  async function setMode(mode: AssistantMode) {
    await run(async (target, signal) => {
      const result = await request('/api/runtime/agent/mode', { ...target, mode }, signal)
      if (!signal.aborted) acceptSnapshot(result, target.accountId)
    })
  }

  async function ask() {
    const text = instruction.value.trim()
    const quoted = quote.value
    if (!text && !quoted) return
    await run(async (target, signal) => {
      await request('/api/runtime/agent/ask', { ...target, text, quote: quoted }, signal)
      if (!signal.aborted) { instruction.value = ''; quote.value = '' }
    })
  }

  async function resolveDraft(id: string, action: 'approve' | 'discard') {
    if (uncertainDrafts.value.includes(id) || !currentDrafts.value.some(item => item.id === id && item.status === 'pending')) return
    await run(async (target, signal) => {
      let result: unknown
      try { result = await request(`/api/runtime/agent/draft/${action}`, { ...target, id }, signal) }
      catch (cause) {
        if (!signal.aborted && action === 'approve') uncertainDrafts.value.push(id)
        throw cause
      }
      if (signal.aborted) return
      const resolved = z.object({ draft: draftSchema }).parse(result).draft
      if (resolved.accountId !== target.accountId || resolved.sessionKey !== assistantKey(target)) throw new Error('草稿归属不一致')
      drafts.value = drafts.value.map(item => item.id === id ? resolved : item)
    })
  }

  watch(() => [shell.activeAccountId, shell.activeAccount?.status], clear, { flush: 'sync' })
  return { context, sessions, currentDrafts, session, enabled, open, quote, instruction, error, busy, connected,
    uncertainDrafts, thinkingText, select, clear, start, setHosting, setMode, ask, resolveDraft }
})
