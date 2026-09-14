import { describe, expect, it } from 'vitest'
import { contactToChatInfo, findNativeConversationForRoute } from './nativeConversation'

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
