import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createSSRApp, defineComponent, h, nextTick } from 'vue'
import { renderToString } from '@vue/server-renderer'

const calls = vi.hoisted(() => ({ profile: vi.fn(), chat: vi.fn(), history: vi.fn(), attrs: {} as Record<string, any> }))
vi.mock('./src/function/connect', () => ({ login: { status: true } }))
vi.mock('./src/function/option', () => ({ run: vi.fn() }))
vi.mock('./src/runtime/backend', () => ({ backend: { isDesktop: () => false } }))
vi.mock('./src/function/utils/systemUtil', () => ({ getInch: () => 0 }))
vi.mock('./src/function/utils/pinyin', () => ({ matchPinyin: () => false }))
vi.mock('./host', () => ({ i18n: { global: { t: (value: string) => value } } }))
vi.mock('./src/components/user/UserListHead.vue', () => ({ default: defineComponent({ render: () => null }) }))
vi.mock('./src/components/user/UserFriendBody.vue', () => ({
  default: defineComponent({ props: ['data', 'from', 'select'], setup(_props, { attrs }) {
    calls.attrs = attrs
    return () => h('contact-item')
  } }),
}))

import UserFriends from './src/pages/user/UserFriends.vue'
import { useContactStore } from './src/state/contact'

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks(); vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('contact selection', () => {
  it.each([
    { user_id: 42, nickname: 'Friend', remark: '', group_name: '', type: 'user' },
    { group_id: 43, group_name: 'Group', type: 'group' },
  ])('separates profile inspection from opening $type chat', async (data) => {
    const contact = useContactStore()
    // Search results and grouped rows use the same handlers.
    contact.showList = [data as any]
    const app = createSSRApp(UserFriends, {
      list: [data], onContactInfo: calls.profile, onUserClick: calls.chat, onLoadHistory: calls.history,
    })
    app.config.globalProperties.$t = (value: string) => value
    app.component('font-awesome-icon', { render: () => null })
    await renderToString(app)
    const item = { props: calls.attrs }
    const event = { currentTarget: { dataset: {} }, stopPropagation: vi.fn() }
    item.props.onClick(event)
    await nextTick()
    expect(calls.profile).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(180)
    expect(calls.profile).toHaveBeenCalledWith(expect.objectContaining({ type: data.type }))
    expect(calls.chat).not.toHaveBeenCalled()
    expect(calls.history).not.toHaveBeenCalled()
    expect(contact.showList).toHaveLength(1)
    // Browser double clicks issue a second click before dblclick.
    item.props.onClick(event)
    vi.stubGlobal('document', { getElementById: () => null })
    item.props.onDblclick(event)
    await vi.advanceTimersByTimeAsync(180)
    expect(calls.chat).toHaveBeenCalledTimes(1)
    expect(calls.history).toHaveBeenCalledTimes(1)
  })
})
