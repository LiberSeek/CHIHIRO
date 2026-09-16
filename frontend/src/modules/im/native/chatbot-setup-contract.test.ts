import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const chat = readFileSync(new URL('./src/pages/user/UserChat.vue', import.meta.url), 'utf8')

describe('ChatBot unconfigured setup hops to workbench model config', () => {
  it('opens 模型配置 instead of an empty AstrBot config picker', () => {
    expect(chat).toContain('needsAstrBotSetup')
    expect(chat).toContain('去配置')
    expect(chat).toContain("selectList('workbench')")
    expect(chat).toContain('openProviderWorkspace')
    expect(chat).toContain('createHostedAgentNavigation')
    expect(chat).toContain("v-if=\"suggest.needsAstrBotSetup\"")
  })
})
