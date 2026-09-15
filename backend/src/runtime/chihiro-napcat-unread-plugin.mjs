// chihiro-recent-contact-unread
import original, { plugin_init as ssqqInit } from './index.ssqq.mjs'

const WRAP_MARK = 'chihiro-recent-contact-unread'
const UNREAD_KEYS = [
  'unreadCnt',
  'unreadCount',
  'unread_cnt',
  'unreadMsgCnt',
  'unread',
  'msgUnreadCnt',
]

function toCount(value) {
  if (value == null || value === '') return null
  if (typeof value === 'object') {
    for (const key of UNREAD_KEYS) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const nested = toCount(value[key])
        if (nested != null) return nested
      }
    }
    return null
  }
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.floor(n)
}

function pickUnread(item) {
  if (!item || typeof item !== 'object') return null
  for (const key of UNREAD_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(item, key)) continue
    const n = toCount(item[key])
    if (n != null) return n
  }
  for (const [key, value] of Object.entries(item)) {
    if (!/unread/i.test(key) || /flag/i.test(key)) continue
    const n = toCount(value)
    if (n != null) return n
  }
  return null
}

function peerKey(item) {
  const uin = item?.peerUin ?? item?.peer_uin ?? item?.uin
  if (uin != null && String(uin) !== '') return String(uin)
  const uid = item?.peerUid ?? item?.peer_uid
  return uid != null && String(uid) !== '' ? String(uid) : ''
}

function attachUnread(results, changedList, logger) {
  if (!Array.isArray(results) || !Array.isArray(changedList) || changedList.length === 0) return
  const unreadByPeer = new Map()
  let sampleKeys = null
  for (const item of changedList) {
    if (!sampleKeys && item && typeof item === 'object') sampleKeys = Object.keys(item)
    const n = pickUnread(item)
    const key = peerKey(item)
    if (n == null || !key) continue
    unreadByPeer.set(key, n)
  }
  if (unreadByPeer.size === 0) {
    logger?.info?.(
      '[chihiro] recent contact snapshot has no unread field',
      sampleKeys || [],
    )
    return
  }
  for (const row of results) {
    const key = peerKey(row)
    if (!key || !unreadByPeer.has(key)) continue
    row.unread = unreadByPeer.get(key)
  }
}

function wrapFunction(target, name, wrapper) {
  const original = target[name]
  if (typeof original !== 'function' || original[WRAP_MARK]) return false
  const wrapped = wrapper(original.bind(target))
  wrapped[WRAP_MARK] = true
  target[name] = wrapped
  return true
}

function wrapRecentContactUnread(ctx) {
  const action = ctx.actions?.get?.('get_recent_contact')
  if (!action) {
    ctx.logger?.warn?.('[chihiro] get_recent_contact action is unavailable')
    return
  }
  const userApi = ctx.core?.apis?.UserApi
  const wrapWithCapture = (originalHandle) => {
    return async function chihiroRecentContactUnread(...args) {
      let captured
      let restore
      if (userApi && typeof userApi.getRecentContactListSnapShot === 'function') {
        const originalSnap = userApi.getRecentContactListSnapShot.bind(userApi)
        userApi.getRecentContactListSnapShot = async (count) => {
          const ret = await originalSnap(count)
          captured = ret
          return ret
        }
        restore = () => { userApi.getRecentContactListSnapShot = originalSnap }
      }
      try {
        const results = await originalHandle(...args)
        try {
          const list = Array.isArray(results) ? results : results?.data
          attachUnread(list, captured?.info?.changedList, ctx.logger)
        } catch (error) {
          ctx.logger?.warn?.('[chihiro] recent_contact unread wrap failed', error)
        }
        return results
      } finally {
        restore?.()
      }
    }
  }
  if (wrapFunction(action, '_handle', wrapWithCapture)) return
  if (wrapFunction(action, 'handle', wrapWithCapture)) return
  if (wrapFunction(action, 'websocketHandle', wrapWithCapture)) return
  ctx.logger?.warn?.('[chihiro] get_recent_contact handle is unavailable')
}

const CONTACT_MARK = 'chihiro-contact-actions'

function obOk(data, echo) {
  return { status: 'ok', retcode: 0, data: data ?? {}, message: '', wording: '', echo, stream: 'normal-action' }
}

function obErr(message, echo) {
  return { status: 'failed', retcode: 200, data: null, message, wording: message, echo, stream: 'normal-action' }
}

function makeAction(fn) {
  return {
    async handle(payload, _adapter, _config, _req, echo) {
      try {
        return obOk(await fn(payload || {}), echo)
      } catch (error) {
        return obErr(error?.message || String(error), echo)
      }
    },
    async websocketHandle(payload, echo, adapter, config, req) {
      return this.handle(payload, adapter, config, req, echo)
    }
  }
}

function idOf(payload, ...keys) {
  for (const key of keys) {
    const value = payload?.[key]
    if (value != null && String(value).trim() !== '') return String(value).trim()
  }
  return ''
}

async function addFriend(core, payload) {
  const userId = idOf(payload, 'user_id', 'userId')
  if (!/^\d+$/.test(userId) || /^0+$/.test(userId)) throw new Error('invalid_user')
  const uid = await core.apis.UserApi.getUidByUinV2(userId)
  if (!uid) throw new Error('用户不存在')
  if (await core.apis.FriendApi.isBuddy(uid)) {
    return { already: true, user_id: userId, uid }
  }
  const message = String(payload.message || payload.comment || '')
  const buddyService = core.context.session.getBuddyService()
  if (typeof buddyService?.reqToAddFriends !== 'function') throw new Error('当前内核没有加好友接口')
  const result = await Promise.resolve(buddyService.reqToAddFriends(uid, message))
  return { already: false, user_id: userId, uid, submitted: true, result: result ?? null }
}

function searchInfo(found) {
  if (!found || typeof found !== 'object') return {}
  return found.searchGroupInfo && typeof found.searchGroupInfo === 'object' ? found.searchGroupInfo : found
}

async function joinGroup(core, payload) {
  const groupId = idOf(payload, 'group_id', 'groupId')
  if (!/^\d+$/.test(groupId) || /^0+$/.test(groupId)) throw new Error('invalid_group')
  const groups = await core.apis.GroupApi.getGroups(false)
  if (Array.isArray(groups) && groups.some((row) => String(row.groupCode ?? row.group_id ?? '') === groupId)) {
    return { already: true, group_id: groupId }
  }
  let found = null
  try {
    found = await core.apis.GroupApi.searchGroup(groupId)
  } catch {
    found = null
  }
  const info = searchInfo(found)
  const auth = String(info.joinGroupAuth || '')
  const comment = String(payload.comment || payload.message || payload.msg || '')
  const groupService = core.context.session.getGroupService()
  if (typeof groupService?.joinGroup !== 'function') throw new Error('当前内核没有入群接口')
  let result
  try {
    result = await Promise.resolve(groupService.joinGroup({
      groupCode: groupId,
      joinGroupAuth: auth,
      msg: comment,
      joinGroupAnswer: comment,
    }))
  } catch {
    result = await Promise.resolve(groupService.joinGroup(groupId, auth))
  }
  return {
    already: false,
    group_id: groupId,
    submitted: true,
    name: info.groupName || found?.groupName || '',
    result: result ?? null
  }
}

function wrapContactActions(ctx) {
  const core = ctx.core
  if (!core || typeof ctx.actions?.get !== 'function') {
    ctx.logger?.warn?.('[chihiro] contact actions unavailable')
    return
  }
  const extras = {
    add_friend: makeAction((payload) => addFriend(core, payload)),
    join_group: makeAction((payload) => joinGroup(core, payload)),
  }
  const originalGet = ctx.actions.get.bind(ctx.actions)
  if (originalGet[CONTACT_MARK]) return
  const wrapped = (name) => {
    const existing = originalGet(name)
    if (existing) return existing
    const key = String(name || '').replace(/_async$|_rate_limited$/, '')
    return extras[key]
  }
  wrapped[CONTACT_MARK] = true
  ctx.actions.get = wrapped
  ctx.logger?.info?.('[chihiro] contact actions registered: add_friend, join_group')
}

export async function plugin_init(ctx) {
  const init = typeof ssqqInit === 'function' ? ssqqInit : original?.plugin_init
  if (typeof init === 'function') await init(ctx)
  wrapRecentContactUnread(ctx)
  wrapContactActions(ctx)
}

const index = { plugin_init }
export default index
