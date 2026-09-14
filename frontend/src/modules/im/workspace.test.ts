import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useImWorkspace } from './workspace'

beforeEach(() => setActivePinia(createPinia()))

describe('shared IM and Agent workspace', () => {
  it('closes the Agent pane and can reopen the same conversation with its draft', () => {
    const workspace = useImWorkspace()
    workspace.selectAgent('research')
    workspace.drafts.research = '整理今天的信息'
    workspace.closeAgent()
    expect(workspace.activePane).toBe('empty')
    expect(workspace.listTab).toBe('workbench')
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
    const workspace = useImWorkspace()
    workspace.selectAgent('research')
    workspace.drafts.research = '整理今天的信息'
    for (const tab of ['messages', 'friends', 'workbench'] as const) {
      workspace.selectList(tab)
      expect(workspace.activePane).toBe('agent')
      expect(workspace.agentSessionId).toBe('research')
      expect(workspace.drafts.research).toBe('整理今天的信息')
    }
  })

  it('opens the workbench list without replacing the QQ conversation', () => {
    const workspace = useImWorkspace()
    workspace.selectIm()
    workspace.selectList('workbench')
    expect(workspace.activePane).toBe('im')
    expect(workspace.agentOpened).toBe(true)
    expect(workspace.agentSessionId).toBeNull()
  })

  it('keeps Agent drafts while switching to QQ and another Agent conversation', () => {
    const workspace = useImWorkspace()
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
