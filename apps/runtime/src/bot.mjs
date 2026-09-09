import { log, logError } from './log.mjs'
import { setAstrbotClient } from './napcat-ob11.mjs'

export function createBotController({ store, qq, astrbot }) {
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
    await astrbot.ensure()
    const reverse = await astrbot.reverseEndpoint()
    await setAstrbotClient(target, reverse, true)
    wired.add(id)
    failedAt.delete(id)
    log('bot', `enabled ${id}`)
  }

  async function unwireAccount(id) {
    const inst = instOf(id)
    const target = inst ? webuiTarget(inst) : null
    if (target) {
      try {
        const reverse = await astrbot.reverseEndpoint()
        await setAstrbotClient(target, reverse, false)
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
      store.patch(id, { botEnabled: true })
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

  return { setEnabled, unwireBeforeRemove, sync, wired }
}
