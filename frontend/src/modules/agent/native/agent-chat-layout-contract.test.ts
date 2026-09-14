import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const userChat = readFileSync(new URL('./src/components/user/UserChat.vue', import.meta.url), 'utf8')
const chatInput = readFileSync(new URL('./src/components/chat/ChatInput.vue', import.meta.url), 'utf8')
const providerModelMenu = readFileSync(new URL('./src/components/chat/ProviderModelMenu.vue', import.meta.url), 'utf8')

describe('hosted Agent chat layout contract', () => {
  it('uses the hosted chat header with a vertical more menu for settings actions', () => {
    expect(userChat).toContain('<UserChatHeader v-if="isChihiroHosted">')
    expect(userChat).toContain('<EllipsisVertical :size="20" />')
    expect(userChat).toContain('function openAstrBotSettings()')
    expect(userChat.indexOf('tm("transport.title")')).toBeGreaterThan(0)
    expect(userChat.indexOf('t("core.common.language")')).toBeGreaterThan(userChat.indexOf('tm("transport.title")'))
    expect(userChat.indexOf('<v-divider class="settings-menu-divider my-1" />')).toBeGreaterThan(userChat.indexOf('t("core.common.language")'))
    expect(userChat.indexOf('<v-list-item class="styled-menu-item settings-menu-item" rounded="md" @click="openAstrBotSettings">')).toBeGreaterThan(userChat.indexOf('<v-divider class="settings-menu-divider my-1" />'))
    expect(userChat).not.toContain('toggleTheme')
  })

  it('keeps provider and model selection inside the composer input controls', () => {
    const rightActions = chatInput.indexOf('<div class="input-right-actions">')
    const selector = chatInput.indexOf('<ProviderModelMenu')
    expect(rightActions).toBeGreaterThan(0)
    expect(selector).toBeGreaterThan(rightActions)
    expect(chatInput.slice(rightActions, selector)).not.toContain('</div>\n        <div class="input-right-actions">')
    expect(providerModelMenu).toContain('variant: "input"')
    expect(userChat).toContain(':show-provider-selector="true"')
  })
})
