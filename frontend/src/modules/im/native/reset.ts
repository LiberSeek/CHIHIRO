import { useAuthStore } from './src/state/auth'
import { useChatStore } from './src/state/chat'
import { useConnectionStore } from './src/state/connection'
import { useContactStore } from './src/state/contact'
import { useQzoneStore } from './src/state/qzone'
import { useSessionHistoryStore } from './src/state/sessionHistory'
import { useStickerStore } from './src/state/sticker'
import { useUIStore } from './src/state/ui'
import { resetNativeMessageRuntimeState } from './src/function/msg'
import { resetNativeFileTasks } from './src/components/user/UserFileManager.vue'

export function resetNativeAccountState(): void {
  resetNativeMessageRuntimeState()
  resetNativeFileTasks()

  const auth = useAuthStore()
  Object.keys(auth.loginInfo).forEach((key) => delete auth.loginInfo[key])
  Object.keys(auth.botInfo).forEach((key) => delete auth.botInfo[key])
  auth.jsonMap = undefined

  const contacts = useContactStore()
  contacts.userList = []
  contacts.showList = []
  contacts.groupAssistList = []
  contacts.baseOnMsgList.clear()
  contacts.onMsgList = []
  contacts.newMsgCount = 0
  contacts.systemNoticesList = undefined

  const chat = useChatStore()
  chat.chatInfo = {
    show: { type: '', id: 0, name: '', avatar: '' },
    info: {
      group_info: {},
      user_info: {},
      me_info: {},
      group_members: [],
      group_files: {},
      group_sub_files: {},
      jin_info: { list: [], pages: 0 },
    },
  }
  chat.messageList = []
  chat.mergeMsgStack = []
  chat.mergeMessageList = undefined
  chat.mergeMessageImgList = undefined

  const connection = useConnectionStore()
  if (connection.metaEventWatchTimer) clearTimeout(connection.metaEventWatchTimer)
  connection.heartbeatTime = -1
  connection.oldHeartbeatTime = -1
  connection.lastHeartbeatTime = -1
  connection.backTimes = 0
  connection.metaEventWatchTimer = undefined
  connection.metaEventTimeoutTriggered = false

  const qzone = useQzoneStore()
  qzone.qzoneFeedList = []
  Object.assign(qzone.state, {
    currentView: 'feed',
    myPagePos: 0,
    myPageSize: 10,
    myHasMore: true,
    myLoading: false,
  })

  useSessionHistoryStore().record = []
  useStickerStore().stickerCache = []

  const ui = useUIStore()
  ui.nowGetHistory = false
  ui.canLoadHistory = true
  ui.loadHistoryFail = false
  ui.historyBeforeTime = undefined
  ui.popBoxList = []
}
