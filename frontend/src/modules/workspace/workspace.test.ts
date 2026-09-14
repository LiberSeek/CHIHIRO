import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { imConversationRouteKey, parseImConversationRouteKey, routeForImConversation, routeForWorkspaceList, useWorkspace } from './workspace'

beforeEach(() => setActivePinia(createPinia()))


describe('workspace routes', () => {
  it('maps list tabs to stable IM routes', () => {
    expect(routeForWorkspaceList('messages')).toEqual({ path: '/im' })
    expect(routeForWorkspaceList('friends')).toEqual({ path: '/im', query: { tab: 'friends' } })
    expect(routeForWorkspaceList('workbench')).toEqual({ path: '/im', query: { tab: 'workbench' } })
  })

  it('maps QQ conversations to refresh-safe IM routes', () => {
    expect(imConversationRouteKey({ type: 'user', id: 10001 })).toBe('user:10001')
    expect(imConversationRouteKey({ type: 'group', id: 20002 })).toBe('group:20002')
    expect(routeForImConversation({ type: 'user', id: 10001 })).toEqual({ path: '/im', query: { chat: 'user:10001' } })
    expect(routeForImConversation({ type: '', id: 0 })).toEqual({ path: '/im' })
    expect(parseImConversationRouteKey('group:20002')).toEqual({ type: 'group', id: 20002 })
    expect(parseImConversationRouteKey('bad:20002')).toBeNull()
  })
})

describe('shared IM and Agent workspace', () => {
  it('closes the Agent pane and can reopen the same conversation with its draft', () => {
    const workspace = useWorkspace()
    workspace.selectAgent('research')
    workspace.drafts.research = '整理今天的信息'
    workspace.closeAgent()
    expect(workspace.activePane).toBe('empty')
    expect(workspace.listTab).toBe('messages')
    expect(workspace.mobilePane).toBe('list')
    expect(workspace.agentOpened).toBe(true)
    expect(workspace.agentSessionId).toBe('research')
    expect(workspace.drafts.research).toBe('整理今天的信息')
    workspace.selectList('messages')
    expect(workspace.activePane).toBe('empty')
    workspace.selectAgent('research')
    expect(workspace.activePane).toBe('agent')
    expect(workspace.mobilePane).toBe('chat')
    expect(workspace.drafts.research).toBe('整理今天的信息')
    workspace.closeAgent()
    workspace.selectIm()
    expect(workspace.activePane).toBe('im')
  })

  it('changes lists without changing the selected Agent or its draft', () => {
    const workspace = useWorkspace()
    workspace.selectAgent('research')
    workspace.drafts.research = '整理今天的信息'
    for (const tab of ['messages', 'friends', 'workbench'] as const) {
      workspace.selectList(tab)
      expect(workspace.activePane).toBe('agent')
      expect(workspace.agentSessionId).toBe('research')
      expect(workspace.drafts.research).toBe('整理今天的信息')
    }
  })

  it('closes the Agent pane without switching the list tab', () => {
    const workspace = useWorkspace()
    workspace.selectList('friends')
    workspace.selectAgent('research')
    workspace.closeAgent()
    expect(workspace.listTab).toBe('friends')
    expect(workspace.activePane).toBe('empty')
    expect(workspace.mobilePane).toBe('list')
  })

  it('opens the workbench list without replacing the QQ conversation', () => {
    const workspace = useWorkspace()
    workspace.selectIm()
    workspace.selectList('workbench')
    expect(workspace.activePane).toBe('im')
    expect(workspace.agentOpened).toBe(true)
    expect(workspace.agentSessionId).toBeNull()
  })

  it('keeps Agent drafts while switching to QQ and another Agent conversation', () => {
    const workspace = useWorkspace()
    workspace.selectAgent('first')
    workspace.drafts.first = '第一份草稿'
    workspace.selectIm()
    workspace.selectAgent('second')
    workspace.drafts.second = '第二份草稿'
    workspace.selectAgent('first')
    expect(workspace.drafts.first).toBe('第一份草稿')
    expect(workspace.drafts.second).toBe('第二份草稿')
    workspace.selectAgent('')
    expect(workspace.drafts['']).toBeUndefined()
  })
})
