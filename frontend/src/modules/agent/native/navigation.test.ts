import { describe, expect, it, vi } from 'vitest'
import { createHostedAgentNavigation, routeForHostedAgent } from './src/navigation'

describe('agent native navigation', () => {
  it('keeps hosted agent sessions inside the unified IM workbench route', () => {
    expect(routeForHostedAgent()).toEqual({ path: '/im', query: { tab: 'workbench' } })
    expect(routeForHostedAgent('session-1')).toEqual({ path: '/im', query: { tab: 'workbench', agent: 'session-1' } })
  })

  it('mirrors hosted navigation into workspace state before pushing the route', async () => {
    const pushed: unknown[] = []
    const router = { push: vi.fn((target: unknown) => { pushed.push(target); return Promise.resolve() }) } as any
    const workspace = {
      selectAgent: vi.fn(),
      selectList: vi.fn(),
      closeAgent: vi.fn(),
    }
    const navigation = createHostedAgentNavigation(router, workspace)

    await navigation.openSession('abc')
    expect(workspace.selectAgent).toHaveBeenCalledWith('abc')
    expect(pushed.at(-1)).toEqual({ path: '/im', query: { tab: 'workbench', agent: 'abc' } })

    await navigation.openSessionList()
    expect(workspace.selectList).toHaveBeenCalledWith('workbench')
    expect(pushed.at(-1)).toEqual({ path: '/im', query: { tab: 'workbench' } })

    await navigation.openProviderWorkspace()
    expect(workspace.selectAgent).toHaveBeenCalledWith('models')
    expect(pushed.at(-1)).toEqual({ path: '/im', query: { tab: 'workbench', agent: 'models' } })

    await navigation.backToWorkspace()
    expect(workspace.closeAgent).toHaveBeenCalled()
    expect(pushed.at(-1)).toEqual({ path: '/im', query: { tab: 'workbench' } })
  })

  it('opens dashboard-only knowledge base and settings through the host settings surface', () => {
    const router = { push: vi.fn() } as any
    const workspace = { selectAgent: vi.fn(), selectList: vi.fn(), closeAgent: vi.fn() }
    const openExternal = vi.fn()
    const navigation = createHostedAgentNavigation(router, workspace, openExternal)

    navigation.openKnowledgeBase()
    navigation.openAstrBotSettings()

    expect(openExternal).toHaveBeenNthCalledWith(1, { title: 'AstrBot 知识库', src: '/astrbot/#/knowledge-base' })
    expect(openExternal).toHaveBeenNthCalledWith(2, { title: 'AstrBot 设置', src: '/astrbot/#/settings' })
    expect(router.push).not.toHaveBeenCalled()
  })
})
