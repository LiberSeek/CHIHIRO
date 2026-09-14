import { describe, expect, it } from 'vitest'
import { syncWorkspaceFromRoute, workspaceRouteMatches } from './routeSync'

describe('workspace route synchronization', () => {
  it('normalizes legacy /agent routes into the unified workbench route', () => {
    expect(syncWorkspaceFromRoute({ name: 'agent', params: { conversationId: 'agent-a' }, query: {} })).toEqual({
      type: 'select-agent',
      sessionId: 'agent-a',
      normalizeTo: { path: '/im', query: { tab: 'workbench', agent: 'agent-a' } },
    })
    expect(syncWorkspaceFromRoute({ name: 'agent', params: {}, query: {} })).toEqual({
      type: 'select-agent',
      sessionId: '',
      normalizeTo: { path: '/im', query: { tab: 'workbench' } },
    })
  })

  it('opens hosted Agent sessions from the IM workbench query', () => {
    expect(syncWorkspaceFromRoute({ name: 'im', query: { tab: 'workbench', agent: 'agent-b' } })).toEqual({
      type: 'select-agent',
      sessionId: 'agent-b',
    })
  })

  it('maps IM list routes without keeping stale agent parameters', () => {
    expect(syncWorkspaceFromRoute({ name: 'im', query: {} })).toEqual({ type: 'select-list', tab: 'messages' })
    expect(syncWorkspaceFromRoute({ name: 'im', query: { tab: 'friends' } })).toEqual({ type: 'select-list', tab: 'friends' })
    expect(syncWorkspaceFromRoute({ name: 'im', query: { tab: 'workbench' } })).toEqual({ type: 'select-list', tab: 'workbench' })
    expect(syncWorkspaceFromRoute({ name: 'im', query: { settings: '1' } })).toEqual({ type: 'none' })
  })

  it('compares workspace routes by supported query keys only', () => {
    expect(workspaceRouteMatches({ path: '/im', query: { tab: 'friends' } }, { path: '/im', query: { tab: 'friends' } })).toBe(true)
    expect(workspaceRouteMatches({ path: '/im', query: { tab: 'workbench', agent: 'old' } }, { path: '/im', query: { tab: 'workbench' } })).toBe(false)
    expect(workspaceRouteMatches({ path: '/im', query: { chat: 'user:1', settings: '1' } }, { path: '/im', query: { chat: 'user:1' } })).toBe(false)
  })
})
