import { routeForHostedAgent } from '@/modules/agent/native/src/navigation'
import type { ListTab, WorkspaceRoute } from './workspace'

export type WorkspaceRouteSyncInput = {
  name?: string | symbol | null
  path?: string
  params?: Record<string, unknown>
  query?: Record<string, unknown>
}

export type WorkspaceRouteSyncAction =
  | { type: 'select-agent'; sessionId: string; normalizeTo?: WorkspaceRoute }
  | { type: 'select-list'; tab: ListTab }
  | { type: 'none' }

export function queryText(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined
  return typeof value === 'string' ? value : undefined
}

export function syncWorkspaceFromRoute(route: WorkspaceRouteSyncInput): WorkspaceRouteSyncAction {
  if (route.name === 'agent') {
    const rawId = route.params?.conversationId
    const sessionId = typeof rawId === 'string' ? rawId : ''
    return {
      type: 'select-agent',
      sessionId,
      normalizeTo: routeForHostedAgent(sessionId || undefined) as WorkspaceRoute,
    }
  }

  if (route.name !== 'im' || route.query?.settings === '1') return { type: 'none' }

  const agentId = queryText(route.query?.agent)
  if (agentId) return { type: 'select-agent', sessionId: agentId }

  if (route.query?.tab) return { type: 'select-list', tab: route.query.tab === 'workbench' ? 'workbench' : 'friends' }

  return { type: 'select-list', tab: 'messages' }
}

export function workspaceRouteMatches(
  current: { path: string; query?: Record<string, unknown> },
  target: WorkspaceRoute,
): boolean {
  return current.path === target.path
    && queryText(current.query?.tab) === target.query?.tab
    && queryText(current.query?.chat) === target.query?.chat
    && queryText(current.query?.agent) === target.query?.agent
    && queryText(current.query?.settings) === undefined
}
