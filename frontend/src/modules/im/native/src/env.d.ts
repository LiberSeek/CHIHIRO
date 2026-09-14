/// <reference types="vite/client" />

import type { CapacitorGlobal } from '@capacitor/core'
import type { ElectronAPI } from '@electron-toolkit/preload'
import type { Translate } from '../../host'

declare global {
  interface Window {
    ChihiroChatUI?: {
      mount(options?: {
        sidebarTarget?: string
        mainTarget?: string
      }): Promise<{ dispose(): void; setActive(active: boolean): void }>
    }
    electron?: ElectronAPI & {
      shell: { openExternal(url: string): Promise<void> }
      process: { versions: Record<string, string> }
    }
    Capacitor?: CapacitorGlobal
    __TAURI_INTERNALS__?: unknown
    moYu: unknown
    _AMapSecurityConfig: string | undefined
    pinyin?: {
      pinyin(value: string, options: {
        heteronym: boolean
        compact: boolean
        style: string
      }): string[][]
    }
    createMap(key: string | undefined, msgId: string, point: {
      lat: number
      lng: number
    }): void
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $t: Translate
    $copyText(value: string): Promise<void>
  }
}

declare module 'vue3-danmaku'
declare module 'markdown-it'
declare module 'semver'
declare module 'jsonpath'
declare module 'animejs'

declare module '*.po' {
  const value: string
  export default value
}

declare module '*.yaml' {
  const content: unknown
  export default content
}

declare module '*.yml' {
  const content: unknown
  export default content
}

export {}
