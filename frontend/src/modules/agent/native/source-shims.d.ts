declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare module '*.js'
declare module '*.mjs'

declare module '@/modules/agent/native/source/utils/toast' {
  export function useToast(): {
    success(message: string, options?: unknown): void
    error(message: string, options?: unknown): void
    info(message: string, options?: unknown): void
    warning(message: string, options?: unknown): void
  }
}

declare module '@/modules/agent/native/source/utils/providerUtils' {
  export function getProviderIcon(providerType: string): string
  export function isMonochromeProviderIcon(providerType: string): boolean
}

declare module '@/modules/agent/native/source/utils/shikiLimitedBundle' {
  export const LIMITED_SHIKI_LANGUAGES: Array<{ name: string }>
  export const LIMITED_SHIKI_LANGUAGE_ALIASES: Record<string, string>
}
