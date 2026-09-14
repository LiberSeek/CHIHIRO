import type { App, Component, InjectionKey } from 'vue'
import type { NativeImHost } from '../im/native/host'
export type WorkspaceLoader = () => Promise<Component>
export const workspaceLoaderKey: InjectionKey<WorkspaceLoader> = Symbol('workspace-loader')
export function createWorkspaceLoader(app: App, navigate: NativeImHost['navigate']): WorkspaceLoader {
  let pending: Promise<Component> | undefined
  return () => pending ??= (async () => {
    const { installNativeIm } = await import('../im/native/runtime')
    await installNativeIm(app, navigate)
    return (await import('./WorkspaceModule.vue')).default
  })().catch(error => { pending = undefined; throw error })
}
