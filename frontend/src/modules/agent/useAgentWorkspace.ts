import { computed, inject, provide, ref, type InjectionKey, type Ref, type ComputedRef } from 'vue'

export interface AgentSession { session_id: string; display_name: string | null; updated_at?: string; project_id?: string | null }
export interface AgentProject { project_id: string; title: string; emoji?: string; description?: string }
export interface AgentMessage { id: string | number; role: 'user' | 'assistant' | 'system'; content: string; created_at?: string; streaming?: boolean; error?: string }
export interface AgentClient {
  listSessions(): Promise<AgentSession[]>; createSession(): Promise<AgentSession>; deleteSession(id: string): Promise<void>; updateSession(id: string, patch: { display_name: string }): Promise<void>; listProjects(): Promise<AgentProject[]>; getMessages(id: string): Promise<AgentMessage[]>
  sendMessage(input: { sessionId: string; message: string; model?: string; signal?: AbortSignal; onDelta?: (text: string) => void }): Promise<string>
}
export interface AgentWorkspaceOptions { apiBase?: string; workspaceId?: string; accountId?: string }
export interface AgentWorkspace {
  sessions: Ref<AgentSession[]>; projects: Ref<AgentProject[]>; activeSessionId: Ref<string>; activeSession: ComputedRef<AgentSession | null>; messages: Ref<AgentMessage[]>; loading: Ref<boolean>; sending: Ref<boolean>; error: Ref<string>; draft: Ref<string>; selectedModel: Ref<string>; models: Ref<string[]>; selectSession: (id: string) => Promise<void>; newSession: () => Promise<void>; deleteSession: (id: string) => Promise<void>; renameSession: (id: string, title: string) => Promise<void>; send: () => Promise<void>; stop: () => void; load: () => Promise<void>
}
function unwrap<T>(payload: any): T { return payload?.data?.data ?? payload?.data ?? payload }
function createHttpClient(base: string, accountId?: string): AgentClient {
  const request = async (path: string, init?: RequestInit) => { const headers = new Headers(init?.headers); headers.set('Accept', 'application/json'); if (init?.body) headers.set('Content-Type', 'application/json'); if (accountId) headers.set('X-Chihiro-Account', accountId); const response = await fetch(`${base.replace(/\/$/, '')}${path}`, { ...init, headers }); if (!response.ok) throw new Error(`Agent API ${response.status}`); return response }
  return {
    async listSessions() { return unwrap<AgentSession[]>(await (await request('/chat/sessions')).json()) ?? [] },
    async createSession() { return unwrap<AgentSession>(await (await request('/chat/sessions/new', { method: 'POST' })).json()) },
    async deleteSession(id) { await request(`/chat/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }) },
    async updateSession(id, patch) { await request(`/chat/sessions/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }) },
    async listProjects() { return unwrap<AgentProject[]>(await (await request('/chat/projects')).json()) ?? [] },
    async getMessages(id) { const data = unwrap<any>(await (await request(`/chat/sessions/${encodeURIComponent(id)}`)).json()); return (data?.messages ?? data?.history ?? []) as AgentMessage[] },
    async sendMessage({ sessionId, message, model, signal, onDelta }) {
      const response = await request('/chat', { method: 'POST', signal, body: JSON.stringify({ session_id: sessionId, message, selected_model: model || undefined, enable_streaming: true }) }); const type = response.headers.get('content-type') || ''
      if (!type.includes('text/event-stream') || !response.body) { const data = unwrap<any>(await response.json()); return String(data?.message ?? data?.content ?? data?.response ?? '') }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let answer = ''
      while (true) { const chunk = await reader.read(); if (chunk.done) break; buffer += decoder.decode(chunk.value, { stream: true }); const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? ''; for (const line of lines) { if (!line.startsWith('data:')) continue; const raw = line.slice(5).trim(); if (!raw || raw === '[DONE]') continue; try { const value = JSON.parse(raw); const text = String(value?.delta ?? value?.text ?? value?.message ?? value?.content ?? ''); if (text) { answer += text; onDelta?.(text) } } catch { /* keepalive/non-json event */ } } }
      return answer
    },
  }
}
const key: InjectionKey<AgentWorkspace> = Symbol('agent-workspace')
export function createAgentWorkspace(options: AgentWorkspaceOptions = {}, client = createHttpClient(options.apiBase ?? '/astrbot/api/v1', options.accountId)): AgentWorkspace {
  const sessions = ref<AgentSession[]>([]); const projects = ref<AgentProject[]>([]); const activeSessionId = ref(''); const messages = ref<AgentMessage[]>([]); const loading = ref(false); const sending = ref(false); const error = ref(''); const draft = ref(''); const selectedModel = ref(''); const models = ref<string[]>([]); let abort: AbortController | null = null
  const activeSession = computed(() => sessions.value.find((item) => item.session_id === activeSessionId.value) ?? null)
  async function selectSession(id: string) { activeSessionId.value = id; loading.value = true; error.value = ''; try { messages.value = await client.getMessages(id) } catch (cause) { error.value = cause instanceof Error ? cause.message : '无法加载会话' } finally { loading.value = false } }
  async function load() { loading.value = true; error.value = ''; try { const [nextSessions, nextProjects] = await Promise.all([client.listSessions(), client.listProjects()]); sessions.value = nextSessions; projects.value = nextProjects; if (!activeSessionId.value && nextSessions[0]) await selectSession(nextSessions[0].session_id) } catch (cause) { error.value = cause instanceof Error ? cause.message : '无法连接 Agent 服务' } finally { loading.value = false } }
  async function newSession() { const session = await client.createSession(); sessions.value = [session, ...sessions.value]; await selectSession(session.session_id) }
  async function deleteSession(id: string) { await client.deleteSession(id); sessions.value = sessions.value.filter((item) => item.session_id !== id); if (activeSessionId.value === id) { activeSessionId.value = ''; messages.value = []; if (sessions.value[0]) await selectSession(sessions.value[0].session_id) } }
  async function renameSession(id: string, title: string) { const display_name = title.trim(); if (!display_name) return; await client.updateSession(id, { display_name }); const session = sessions.value.find((item) => item.session_id === id); if (session) session.display_name = display_name }
  async function send() { const text = draft.value.trim(); if (!text || !activeSessionId.value || sending.value) return; sending.value = true; error.value = ''; draft.value = ''; const user: AgentMessage = { id: `u-${Date.now()}`, role: 'user', content: text }; const assistant: AgentMessage = { id: `a-${Date.now()}`, role: 'assistant', content: '', streaming: true }; messages.value.push(user, assistant); abort = new AbortController(); try { const answer = await client.sendMessage({ sessionId: activeSessionId.value, message: text, model: selectedModel.value, signal: abort.signal, onDelta: (delta) => { assistant.content += delta } }); if (!assistant.content) assistant.content = answer } catch (cause) { if ((cause as Error).name !== 'AbortError') { assistant.error = cause instanceof Error ? cause.message : '发送失败'; error.value = assistant.error } } finally { assistant.streaming = false; sending.value = false; abort = null } }
  function stop() { abort?.abort() }
  return { sessions, projects, activeSessionId, activeSession, messages, loading, sending, error, draft, selectedModel, models, selectSession, newSession, deleteSession, renameSession, send, stop, load }
}
export function provideAgentWorkspace(workspace: AgentWorkspace) { provide(key, workspace); return workspace }
export function useAgentWorkspace() { const workspace = inject(key); if (!workspace) throw new Error('AgentWorkspaceProvider is missing'); return workspace }
