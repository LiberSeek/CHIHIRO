import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { resetMessageRuntime } = vi.hoisted(() => ({ resetMessageRuntime: vi.fn() }))
vi.mock('./src/function/msg', () => ({
  dispatch: vi.fn(),
  resetNativeMessageRuntimeState: resetMessageRuntime,
}))
vi.mock('./src/function/utils/appUtil', () => ({
  downloadFile: vi.fn(() => () => undefined),
}))
vi.mock('./src/function/utils/systemUtil', () => ({
  getInch: vi.fn(() => 1),
}))

import { resetNativeAccountState } from './reset'
import { setNativeViewerHost } from './viewer'
import { useAuthStore } from './src/state/auth'
import { useChatStore } from './src/state/chat'
import { useConnectionStore } from './src/state/connection'
import { useContactStore } from './src/state/contact'
import { useQzoneStore } from './src/state/qzone'
import { useSessionHistoryStore } from './src/state/sessionHistory'
import { useSettingsStore } from './src/state/settings'
import { useStickerStore } from './src/state/sticker'
import { useUIStore } from './src/state/ui'
import {
  addUploadTask,
  getUploadTasks,
  openPanel,
  panelVisible,
} from './src/components/user/UserFileManager.vue'

describe('resetNativeAccountState', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetMessageRuntime.mockClear()
  })

  it('clears account state and transfer tasks while preserving app settings', () => {
    const auth = useAuthStore()
    auth.loginInfo.uin = 10001
    auth.botInfo.nickname = 'old account'
    auth.jsonMap = { message: true }

    const contacts = useContactStore()
    contacts.userList = [{ user_id: 2 } as never]
    contacts.showList = [{ user_id: 2 } as never]
    contacts.groupAssistList = [{ group_id: 3 } as never]
    contacts.baseOnMsgList.set(2, { user_id: 2 } as never)
    contacts.onMsgList = [{ user_id: 2 } as never]
    contacts.newMsgCount = 4
    contacts.systemNoticesList = [{ flag: 'old' }]

    const chat = useChatStore()
    chat.chatInfo.show = { type: 'user', id: 2, name: 'old', avatar: 'old' }
    chat.messageList = [{ message_id: 1 }]
    chat.mergeMsgStack = [{} as never]
    chat.mergeMessageList = [{}]
    chat.mergeMessageImgList = ['old']

    const connection = useConnectionStore()
    connection.heartbeatTime = 1
    connection.oldHeartbeatTime = 2
    connection.lastHeartbeatTime = 3
    connection.backTimes = 4
    connection.metaEventTimeoutTriggered = true

    const qzone = useQzoneStore()
    qzone.qzoneFeedList = [{ id: 1 }]
    Object.assign(qzone.state, { currentView: 'my', myPagePos: 20, myHasMore: false, myLoading: true })

    useSessionHistoryStore().record = [{ user_id: 2 } as never]
    useStickerStore().stickerCache = [{ id: 1 }]
    const ui = useUIStore()
    ui.nowGetHistory = true
    ui.canLoadHistory = false
    ui.loadHistoryFail = true
    ui.historyBeforeTime = 123
    ui.popBoxList = [{ title: 'old' }]

    const settings = useSettingsStore()
    settings.sysConfig.accountScopedProbe = 'preserved-app-setting'
    settings.darkMode = true

    addUploadTask({ fileName: 'old.txt', fileSize: 10, execute: () => undefined })
    openPanel()
    const closeViewer = vi.fn()
    const unregisterViewer = setNativeViewerHost({ close: closeViewer })

    resetNativeAccountState()

    expect(closeViewer).toHaveBeenCalledOnce()
    unregisterViewer()
    expect(resetMessageRuntime).toHaveBeenCalledOnce()
    expect(Object.keys(auth.loginInfo)).toHaveLength(0)
    expect(Object.keys(auth.botInfo)).toHaveLength(0)
    expect(auth.jsonMap).toBeUndefined()
    expect(contacts.$state).toMatchObject({
      userList: [], showList: [], groupAssistList: [], onMsgList: [], newMsgCount: 0,
      systemNoticesList: undefined,
    })
    expect(contacts.baseOnMsgList.size).toBe(0)
    expect(chat.messageList).toEqual([])
    expect(chat.mergeMsgStack).toEqual([])
    expect(chat.mergeMessageList).toBeUndefined()
    expect(chat.mergeMessageImgList).toBeUndefined()
    expect(chat.chatInfo.show.id).toBe(0)
    expect(connection.$state).toMatchObject({
      heartbeatTime: -1, oldHeartbeatTime: -1, lastHeartbeatTime: -1, backTimes: 0,
      metaEventWatchTimer: undefined, metaEventTimeoutTriggered: false,
    })
    expect(qzone.qzoneFeedList).toEqual([])
    expect(qzone.state).toMatchObject({ currentView: 'feed', myPagePos: 0, myHasMore: true, myLoading: false })
    expect(useSessionHistoryStore().record).toEqual([])
    expect(useStickerStore().stickerCache).toEqual([])
    expect(ui.$state).toMatchObject({
      nowGetHistory: false, canLoadHistory: true, loadHistoryFail: false,
      historyBeforeTime: undefined, popBoxList: [],
    })
    expect(getUploadTasks()).toEqual([])
    expect(panelVisible.value).toBe(false)
    expect(settings.sysConfig.accountScopedProbe).toBe('preserved-app-setting')
    expect(settings.darkMode).toBe(true)
  })

  it('ignores progress callbacks retained by work from the previous account', () => {
    let staleProgress: ((loaded: number, total: number) => void) | undefined
    addUploadTask({
      fileName: 'old.txt',
      fileSize: 10,
      execute: (onProgress) => { staleProgress = onProgress },
    })

    resetNativeAccountState()
    addUploadTask({ fileName: 'new.txt', fileSize: 20, execute: () => undefined })
    staleProgress?.(10, 10)

    expect(getUploadTasks()).toHaveLength(1)
    expect(getUploadTasks()[0]).toMatchObject({ fileName: 'new.txt', progress: 0, uploaded: 0 })
  })
})
