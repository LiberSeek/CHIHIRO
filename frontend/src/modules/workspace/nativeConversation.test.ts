import { describe, expect, it } from 'vitest'
import { canRestoreNativeConversation, contactToChatInfo, findNativeConversationForRoute } from './nativeConversation'

describe('native IM conversation route restoration', () => {
  it('converts friend and group contacts to stable chat info', () => {
    expect(contactToChatInfo({ user_id: 10001, remark: '备注名', nickname: '昵称' } as any)).toEqual({
      type: 'user',
      id: 10001,
      name: '备注名',
      avatar: 'https://q1.qlogo.cn/g?b=qq&s=0&nk=10001',
    })
    expect(contactToChatInfo({ group_id: 20002, group_name: '群名称' } as any)).toEqual({
      type: 'group',
      id: 20002,
      name: '群名称',
      avatar: 'https://p.qlogo.cn/gh/20002/20002/0',
    })
    expect(contactToChatInfo({} as any)).toBeNull()
  })

  it('restores routed conversations only when type and id match the route', () => {
    const cachedGroup = { group_id: 123, group_name: '同 ID 群' } as any
    const friend = { user_id: 123, nickname: '同 ID 好友', remark: '' } as any
    const sources = {
      baseOnMsgList: new Map([[123, cachedGroup]]),
      onMsgList: [friend],
      groupAssistList: [],
      userList: [],
    }

    expect(findNativeConversationForRoute('group:123', sources)).toMatchObject({ type: 'group', id: 123, name: '同 ID 群' })
    expect(findNativeConversationForRoute('user:123', sources)).toMatchObject({ type: 'user', id: 123, name: '同 ID 好友' })
    expect(findNativeConversationForRoute('user:-10000', sources)).toEqual({ type: 'user', id: -10000, name: '系统消息', avatar: '' })
    expect(findNativeConversationForRoute('bad:123', sources)).toBeNull()
  })
})


describe('native IM conversation restoration guard', () => {
  const readyState = {
    routeName: 'im',
    routeChat: 'user:10001',
    activeAccountId: 'account-a',
    readyAccountId: 'account-a',
  }

  it('allows restoration only after the active account is the ready native account', () => {
    expect(canRestoreNativeConversation(readyState)).toBe(true)
    expect(canRestoreNativeConversation({ ...readyState, readyAccountId: 'account-b' })).toBe(false)
    expect(canRestoreNativeConversation({ ...readyState, readyAccountId: null })).toBe(false)
    expect(canRestoreNativeConversation({ ...readyState, activeAccountId: null })).toBe(false)
  })

  it('does not restore while the route points at settings, a list tab, or an active connection', () => {
    expect(canRestoreNativeConversation({ ...readyState, routeSettings: '1' })).toBe(false)
    expect(canRestoreNativeConversation({ ...readyState, routeTab: 'friends' })).toBe(false)
    expect(canRestoreNativeConversation({ ...readyState, connecting: true })).toBe(false)
    expect(canRestoreNativeConversation({ ...readyState, routeName: 'agent' })).toBe(false)
    expect(canRestoreNativeConversation({ ...readyState, routeChat: undefined })).toBe(false)
  })
})
