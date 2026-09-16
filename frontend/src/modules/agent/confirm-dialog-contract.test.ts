import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const agentModule = readFileSync(new URL('./AgentModule.vue', import.meta.url), 'utf8')
const confirmDialog = readFileSync(new URL('./ConfirmDialog.vue', import.meta.url), 'utf8')
const userChat = readFileSync(new URL('./native/src/components/user/UserChat.vue', import.meta.url), 'utf8')
const confirmUtil = readFileSync(new URL('./native/src/utils/confirmDialog.ts', import.meta.url), 'utf8')
const zhChat = JSON.parse(readFileSync(new URL('./native/src/i18n/locales/zh-CN/features/chat.json', import.meta.url), 'utf8')) as {
  conversation: { confirmDeleteTitle: string; confirmDelete: string }
}

describe('hosted Agent confirm dialog', () => {
  it('provides an in-app confirm dialog instead of the browser popup', () => {
    expect(agentModule).toContain("import ConfirmDialog from './ConfirmDialog.vue'")
    expect(agentModule).toContain("provide('$confirm'")
    expect(agentModule).toContain('<ConfirmDialog ref="confirmDialog" />')
    expect(confirmDialog).toContain('class="chihiro-confirm-card"')
    expect(confirmDialog).toContain('<Teleport to="body">')
    expect(userChat).not.toContain('window.confirm')
    expect(confirmUtil).toContain('confirmText?: string')
  })

  it('uses Gemini-style delete copy for conversations', () => {
    expect(zhChat.conversation.confirmDeleteTitle).toBe('要删除对话吗？')
    expect(zhChat.conversation.confirmDelete).toContain('永久删除')
    expect(userChat).toContain('tm("conversation.confirmDeleteTitle")')
    expect(userChat).toContain('t("core.common.delete")')
  })
})
