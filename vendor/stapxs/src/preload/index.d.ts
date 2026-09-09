import { ElectronAPI } from '@electron-toolkit/preload'
import { Shell } from 'electron'
import { CapacitorGlobal } from '@capacitor/core'

declare module '@electron-toolkit/preload' {
    interface ElectronAPI {
        shell: Shell
    }
}

declare global {
    interface Window {
        electron: ElectronAPI
        api: unknown
        // 这个 Capacitor 会主动注入到 window 对象中，此处只是声明类型
        Capacitor: CapacitorGlobal
    }
}
