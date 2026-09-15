import type { App, Component, InjectionKey } from 'vue'
import { clearStaleChunkRecovery, recoverStaleChunk } from '@/app/stale-chunk'

export type AgentLoader = () => Promise<Component>
export const agentLoaderKey: InjectionKey<AgentLoader> = Symbol('agent-loader')

/** Install native services in the existing app only when the workbench opens. */
export function createAgentLoader(app: App): AgentLoader {
  let pending: Promise<Component> | undefined
  return () => {
    pending ??= (async () => {
      const { installAgentNative } = await import('./native/runtime')
      await installAgentNative(app, { hosted: true, gatewayBase: '/astrbot' })
      const { default: component } = await import('./AgentModule.vue')
      return component
    })().then(component => {
      clearStaleChunkRecovery()
      return component
    }).catch(error => {
      pending = undefined
      recoverStaleChunk(error)
      throw error
    })
    return pending
  }
}
