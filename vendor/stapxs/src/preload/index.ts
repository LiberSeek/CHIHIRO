import { contextBridge, shell } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// import { Capacitor } from '@capacitor/core'

// Custom APIs for renderer
const api = {}

// 拓展 electronAPI
const extendedElectronAPI = {
    ...electronAPI,
    shell: shell
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', extendedElectronAPI)
        contextBridge.exposeInMainWorld('api', api)
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error)
    }
} else {
    // @ts-ignore (define in dts)
    window.electron = extendedElectronAPI
    // @ts-ignore (define in dts)
    window.api = api
}
