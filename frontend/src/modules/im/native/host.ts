export type Translate = (key: string, values?: Record<string, unknown> | number) => string

export const uptime = Date.now()

export interface NativeImI18n {
  global: {
    locale: string | { value: string }
    fallbackLocale: unknown
    t: Translate
    setLocaleMessage(locale: string, messages: unknown): void
  }
}

export interface NativeImHost {
  copyText(value: string): Promise<void>
  i18n: NativeImI18n
  navigate?(view: 'messages' | 'friends' | 'workbench'): void
}

let configuredHost: NativeImHost | undefined

export function configureNativeImHost(host: NativeImHost): void {
  configuredHost = host
}

function host(): NativeImHost {
  if (!configuredHost) throw new Error('Native IM host has not been configured')
  return configuredHost
}

export function navigateNativeIm(view: 'messages' | 'friends' | 'workbench'): void {
  host().navigate?.(view)
}

export const i18n: NativeImI18n = new Proxy({} as NativeImI18n, {
  get: (_target, property) => Reflect.get(host().i18n, property),
})

export default {
  config: {
    globalProperties: {
      get $t(): Translate {
        return host().i18n.global.t
      },
      get $i18n(): NativeImI18n['global'] {
        return host().i18n.global
      },
      $copyText(value: string): Promise<void> {
        return host().copyText(value)
      },
    },
  },
}
