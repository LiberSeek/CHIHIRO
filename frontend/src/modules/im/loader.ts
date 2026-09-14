import type { App, Component, InjectionKey } from 'vue'
import type { NativeImHost } from './native/host'
export type ImLoader = () => Promise<Component>
export const imLoaderKey: InjectionKey<ImLoader> = Symbol('im-loader')
export function createImLoader(app: App, navigate: NativeImHost['navigate']): ImLoader {
  let pending: Promise<Component> | undefined
  return () => pending ??= (async () => {
    const { installNativeIm } = await import('./native/runtime')
    await installNativeIm(app, navigate)
    return (await import('./ImModule.vue')).default
  })().catch(error => { pending = undefined; throw error })
}
