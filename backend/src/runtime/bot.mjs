import { log, logError } from './log.mjs'
import { setAstrbotClient } from './napcat-ob11.mjs'
import { astrbotReversePort } from './qq-ports.mjs'

export function createBotController({ store, qq, astrbot, cfg }) {
  const wired = new Set()
  const failedAt = new Map()

  function accountOf(id) {
    return (store.list().accounts || []).find((a) => a.id === id) || null
  }

  function instOf(id) {
    return qq.getInstanceForAccount?.(id) || null
  }

  function webuiTarget(inst) {
    if (!inst?.ports?.webui || !inst.tokens?.webui) return null
    return {
      webui: `http://127.0.0.1:${inst.ports.webui}`,
      token: inst.tokens.webui
    }
  }

  async function wireAccount(id) {
    const inst = instOf(id)
    if (!inst || inst.phase !== 'ready') {
      throw new Error('账号尚未在线，无法开启 Bot')
    }
    const target = webuiTarget(inst)
    if (!target) throw new Error('缺少该账号的 NapCat WebUI')
    const reverse = await astrbot.ensureAdapter({
      uin: inst.uin,
      reversePort: astrbotReversePort(inst.ports),
      enable: true
    })
    const gwHost = cfg?.gateway?.host || '127.0.0.1'
    const gwPort = cfg?.gateway?.port || 3100
    await setAstrbotClient(target, {
      ...reverse,
      url: `ws://${gwHost}:${gwPort}/i/${encodeURIComponent(inst.id)}/bot-ob`
    }, true, inst.uin)
    wired.add(id)
    failedAt.delete(id)
    log('bot', `enabled ${id}`)
  }

  async function unwireAccount(id) {
    const inst = instOf(id)
    const target = inst ? webuiTarget(inst) : null
    if (target) {
      try {
        const reverse = await astrbot.reverseEndpoint(inst.uin, astrbotReversePort(inst.ports))
        await setAstrbotClient(target, reverse, false, inst.uin)
      } catch (e) {
        logError('bot', `unwire ${id}`, e)
      }
    }
    wired.delete(id)
    failedAt.delete(id)
    log('bot', `disabled ${id}`)
  }

  function anyEnabled() {
    return (store.list().accounts || []).some((a) => a.botEnabled)
  }

  async function setEnabled(id, enabled) {
    const acc = accountOf(id)
    if (!acc) throw new Error('account_not_found')
    if (acc.client && acc.client !== 'qq') {
      throw new Error('当前仅 QQ 账号支持 Bot')
    }
    if (enabled) {
      await wireAccount(id)
      const inst = instOf(id)
      const patch = { botEnabled: true }
      if (inst?.ports) patch.ports = { ...inst.ports, astrbotReverse: astrbotReversePort(inst.ports) }
      store.patch(id, patch)
    } else {
      await unwireAccount(id)
      store.patch(id, { botEnabled: false })
      if (!anyEnabled()) {
        await astrbot.stopIfOwned()
      }
    }
    qq.touch?.()
    return qq.snapshot()
  }

  async function setSession(id, type, peerId, enabled) {
    const acc = accountOf(id)
    if (!acc) throw new Error('account_not_found')
    const key = `${type === 'group' ? 'group' : 'private'}:${String(peerId)}`
    const map = { ...(acc.botSessions || {}) }
    map[key] = Boolean(enabled)
    store.patch(id, { botSessions: map })
    const any = Object.values(map).some(Boolean)
    if (enabled && !acc.botEnabled) return setEnabled(id, true)
    if (!any && acc.botEnabled) return setEnabled(id, false)
    qq.touch?.()
    return qq.snapshot()
  }

  async function unwireBeforeRemove(id) {
    const acc = accountOf(id)
    if (!acc?.botEnabled && !wired.has(id)) return
    await unwireAccount(id).catch((e) => logError('bot', 'remove unwire', e))
    if (!anyEnabled()) await astrbot.stopIfOwned().catch(() => {})
  }

  async function sync() {
    const accounts = store.list().accounts || []
    for (const acc of accounts) {
      if (!acc.botEnabled) {
        if (wired.has(acc.id)) await unwireAccount(acc.id).catch(() => {})
        continue
      }
      const inst = instOf(acc.id)
      if (inst?.phase !== 'ready') continue
      if (wired.has(acc.id)) continue
      const last = failedAt.get(acc.id) || 0
      if (Date.now() - last < 8000) continue
      try {
        await wireAccount(acc.id)
      } catch (e) {
        failedAt.set(acc.id, Date.now())
        logError('bot', `sync ${acc.id}`, e)
        const st = astrbot.status()
        st.error = e.message
      }
    }
    if (accounts.some((a) => a.botEnabled)) {
      try {
        if (!(await astrbot.refreshStatus()).running) {
          await astrbot.ensure()
        }
      } catch (e) {
        logError('bot', 'sync ensure', e)
      }
    }
  }

  return { setEnabled, setSession, unwireBeforeRemove, sync, wired }
}
