import type { BaseChatInfoElem, UserFriendElem, UserGroupElem } from '@/modules/im/native/src/function/elements/information'
import { parseImConversationRouteKey } from './workspace'

type NativeContactItem = Partial<UserFriendElem & UserGroupElem> | undefined | null

export function contactToChatInfo(item: NativeContactItem): BaseChatInfoElem | null {
  if (!item) return null
  const id = item.user_id ? item.user_id : item.group_id
  if (!id) return null
  const isUser = Boolean(item.user_id)
  const name = isUser
    ? (item.remark || item.nickname || String(id))
    : (item.group_name || String(id))
  return {
    type: isUser ? 'user' : 'group',
    id,
    name,
    avatar: isUser
      ? `https://q1.qlogo.cn/g?b=qq&s=0&nk=${id}`
      : `https://p.qlogo.cn/gh/${id}/${id}/0`,
  }
}

export function findNativeConversationForRoute(
  routeChat: unknown,
  sources: {
    baseOnMsgList?: Map<number, UserFriendElem & UserGroupElem>
    onMsgList?: Array<UserFriendElem & UserGroupElem>
    groupAssistList?: Array<UserFriendElem & UserGroupElem>
    userList?: Array<UserFriendElem & UserGroupElem>
  },
): BaseChatInfoElem | null {
  const parsed = parseImConversationRouteKey(routeChat)
  if (!parsed) return null
  if (parsed.id === -10000) return { type: 'user', id: -10000, name: '系统消息', avatar: '' }

  const fromCache = sources.baseOnMsgList?.get(parsed.id)
  const lists: NativeContactItem[] = [
    fromCache,
    ...(sources.onMsgList ?? []),
    ...(sources.groupAssistList ?? []),
    ...(sources.userList ?? []),
  ]
  for (const item of lists) {
    if (!item) continue
    const itemType = item.user_id ? 'user' : 'group'
    const itemId = item.user_id ? item.user_id : item.group_id
    if (itemType === parsed.type && itemId === parsed.id) return contactToChatInfo(item)
  }
  return null
}
