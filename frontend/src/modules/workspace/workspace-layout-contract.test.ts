import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./WorkspaceModule.vue', import.meta.url), 'utf8')

describe('workspace layout contract', () => {
  it('hosts Agent sidebar in the list workspace and Agent thread in the IM chat region', () => {
    expect(source).toContain('<aside class="native-list">')
    expect(source).toContain('<main class="native-chat">')
    expect(source).toContain('ref="agentSidebar" class="native-list-content"')
    expect(source).toContain('ref="agentThread" v-show="workspace.activePane === \'agent\'" class="native-thread-content"')
    expect(source).toContain(':sidebar-target="agentSidebar"')
    expect(source).toContain(':thread-target="agentThread"')
    expect(source).not.toContain('src="/astrbot')
    expect(source).not.toContain('ChihiroChatUI.mount')
  })

  it('keeps the shared empty state and global toast outside the list column', () => {
    expect(source.match(/选择 对话\/任务 开始/g)?.length).toBeGreaterThanOrEqual(2)
    expect(source).toContain('<Teleport to="body">')
    expect(source).toContain('class="app-msg chihiro-global-toast"')
    expect(source).toContain('.chihiro-global-toast.app-msg { position:fixed; left:50%; top:16px;')
  })

  it('keeps list surface and tab height tokens aligned for IM and workbench', () => {
    expect(source).toContain('.chihiro-native-im .native-list { display:flex; flex-direction:column; min-height:0; border-right:1px solid var(--color-card-2); background:var(--color-card-1); }')
    expect(source).toContain('flex:0 0 52px;')
    expect(source).toContain('height:52px;')
    expect(source).toContain('.chihiro-native-im .native-list-content { position:relative; flex:1; min-height:0; overflow:hidden; background:var(--color-card-1); }')
  })
})
