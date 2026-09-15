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

export async function plugin_init(ctx) {
  const init = typeof ssqqInit === 'function' ? ssqqInit : original?.plugin_init
  if (typeof init === 'function') await init(ctx)
  wrapRecentContactUnread(ctx)
}

const index = { plugin_init }
export default index
