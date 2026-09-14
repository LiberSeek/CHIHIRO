<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DOMPurify from 'dompurify'
import { ChevronLeft } from '@lucide/vue'
import { useShellStore } from '@/stores/shell'
import { useAssistantStore } from '@/modules/assistant/session'
import { accountSessionManagerKey } from '@/services/account-session-host'
import { Connector, login } from '../im/native/src/function/connect'
import { resetNativeAccountState } from '../im/native/reset'
import { clearNativePopups } from '../im/native/popups'
import { selectNativeAccountOptions } from '../im/native/src/function/option'
import { useAuthStore } from '../im/native/src/state/auth'
import { useChatStore } from '../im/native/src/state/chat'
import { useContactStore } from '../im/native/src/state/contact'
import { useUIStore } from '../im/native/src/state/ui'
import { useSettingsStore } from '../im/native/src/state/settings'
import { loadHistory } from '../im/native/src/function/utils/appUtil'
import { PopInfo, popList } from '../im/native/src/function/base'
import type { BaseChatInfoElem } from '../im/native/src/function/elements/information'
import UserMessages from '../im/native/src/pages/user/UserMessages.vue'
import UserFriends from '../im/native/src/pages/user/UserFriends.vue'
import UserChat from '../im/native/src/pages/user/UserChat.vue'
import UserSystemNotice from '../im/native/src/pages/user/UserSystemNotice.vue'
import UserOptions from '../im/native/src/pages/user/UserOptions.vue'
import UserViewer from '../im/native/src/components/user/UserViewerCom.vue'
import UserTooltips from '../im/native/src/components/user/tooltip/UserTooltips.vue'
import UserFileManager, { panelVisible } from '../im/native/src/components/user/UserFileManager.vue'
import { setNativeViewerHost } from '../im/native/viewer'
import AgentEntry from '../agent/AgentEntry.vue'
import { routeForImConversation, routeForWorkspaceList, useWorkspace, type ListTab, type WorkspaceRoute } from './workspace'
import { queryText, syncWorkspaceFromRoute, workspaceRouteMatches } from './routeSync'
import { canRestoreNativeConversation, contactToChatInfo, findNativeConversationForRoute } from './nativeConversation'
import { countNativeUnreadSessions, nativeUnreadOwnerAccountId } from './nativeUnread'

const workspace = useWorkspace()
const imListTab = ref<'messages' | 'friends'>('messages')
watch(() => workspace.listTab, tab => { if (tab !== 'workbench') imListTab.value = tab }, { immediate: true })
const agentSidebar = ref<HTMLElement>()
const agentThread = ref<HTMLElement>()
const sessions = inject(accountSessionManagerKey)!
const shell = useShellStore()
const assistant = useAssistantStore()
const route = useRoute()
const router = useRouter()
const chat = useChatStore()
const contacts = useContactStore()
const auth = useAuthStore()
const ui = useUIStore()
const settings = useSettingsStore()
const viewer = ref<InstanceType<typeof UserViewer>>()
const profileOnly = ref(false)
provide('viewer', { viewer })
const error = ref('')
let generation = 0
let detach: (() => void) | undefined
let detachViewer: (() => void) | undefined
const hasChat = computed(() => chat.chatInfo.show.id !== 0)
const showSettings = computed(() => route.query.settings === '1')
const connectingNativeAccountId = ref<string | null>(null)
const readyNativeAccountId = ref<string | null>(null)
const nativeAccountConnecting = computed(() => {
  const account = shell.activeAccount
  return Boolean(account && account.status === 'online' && !error.value
    && (!login.status || readyNativeAccountId.value !== account.id))
})
watch(() => route.fullPath, () => {
  const action = syncWorkspaceFromRoute({
    name: route.name,
    params: route.params,
    query: route.query,
  })
  if (action.type === 'select-agent') {
    workspace.selectList('workbench')
    workspace.selectAgent(action.sessionId)
    if (action.normalizeTo) void router.replace(action.normalizeTo)
  } else if (action.type === 'select-list') {
    workspace.selectList(action.tab)
  }
}, { immediate: true })
const modal = computed(() => ui.popBoxList[0])
const safeModalHtml = computed(() => DOMPurify.sanitize(modal.value?.html ?? ''))
const popInfo = new PopInfo()
const unreadCount = computed(() => countNativeUnreadSessions(
  contacts.onMsgList || [],
  contacts.groupAssistList || [],
  Number(contacts.newMsgCount) || 0,
))
const unreadLabel = computed(() => unreadCount.value > 99 ? '99+' : String(unreadCount.value))
const unreadOwnerAccountId = computed(() => nativeUnreadOwnerAccountId({
  activeAccountId: shell.activeAccountId,
  activeAccountOnline: shell.activeAccount?.status === 'online',
  readyAccountId: readyNativeAccountId.value,
}))

async function connect() {
  profileOnly.value = false
  const current = ++generation
  detach?.()
  detach = undefined
  if (workspace.activePane === 'im') workspace.mobilePane = 'list'
  const account = shell.activeAccount
  connectingNativeAccountId.value = account?.id ?? null
  readyNativeAccountId.value = null
  resetNativeAccountState()
  error.value = ''
  selectNativeAccountOptions(account?.id)
  if (!account || account.status !== 'online') {
    connectingNativeAccountId.value = null
    return
  }
  try {
    const session = await sessions.connect(account)
    if (current !== generation) return
    detach = Connector.bind(session, () => {
      if (current !== generation) return
      error.value = '连接已断开'
      void sessions.disconnect(account.id)
    })
    Connector.start()
  } catch (cause) {
    if (current === generation) error.value = cause instanceof Error ? cause.message : String(cause)
  }
}

function replaceWorkspaceRoute(target: WorkspaceRoute) {
  if (!workspaceRouteMatches(route, target)) void router.replace(target)
}

function changeChat(info: BaseChatInfoElem) {
  clearNativePopups()
  workspace.selectIm()
  replaceWorkspaceRoute(routeForImConversation(info))
  if (chat.chatInfo.show.id === info.id && chat.chatInfo.show.type === info.type) return
  chat.chatInfo = {
    show: info,
    info: { group_info: {}, user_info: {}, me_info: {}, group_members: [],
      group_files: {}, group_sub_files: {}, jin_info: { list: [], pages: 0 } },
  }
  chat.messageList = []
  chat.mergeMessageList = undefined
  ui.canLoadHistory = true
  ui.nowGetHistory = false
  ui.loadHistoryFail = false
  if (info.type === 'group') {
    Connector.send('get_group_member_info', { group_id: info.id, user_id: auth.loginInfo.uin }, 'getUserInfoInGroup')
    Connector.send('get_group_member_list', { group_id: info.id, no_cache: true }, 'getGroupMemberList')
  }
}

function selectList(tab: ListTab) {
  workspace.selectList(tab)
  replaceWorkspaceRoute(routeForWorkspaceList(tab))
}

function findRoutedConversation(): BaseChatInfoElem | null {
  return findNativeConversationForRoute(route.query.chat, {
    baseOnMsgList: contacts.baseOnMsgList,
    onMsgList: contacts.onMsgList,
    groupAssistList: contacts.groupAssistList,
    userList: contacts.userList,
  })
}

function restoreRoutedConversation() {
  if (!canRestoreNativeConversation({
    routeName: route.name,
    routeSettings: route.query.settings,
    routeTab: route.query.tab,
    routeChat: route.query.chat,
    connecting: nativeAccountConnecting.value,
    activeAccountId: shell.activeAccountId,
    readyAccountId: readyNativeAccountId.value,
  })) return
  const target = findRoutedConversation()
  if (!target) return
  profileOnly.value = false
  if (chat.chatInfo.show.id === target.id && chat.chatInfo.show.type === target.type) return
  changeChat(target)
  loadHistory(target)
}

function inspectContact(info: BaseChatInfoElem) {
  profileOnly.value = true
  changeChat(info)
}

function openContactChat(info: BaseChatInfoElem) {
  profileOnly.value = false
  ui.nowGetHistory = false
  if (info.id > 0) workspace.selectList('messages')
  changeChat(info)
}

function sendToContact() {
  const info = chat.chatInfo.show
  openContactChat(info)
  loadHistory(info)
}

function closeContactProfile() {
  profileOnly.value = false
  chat.chatInfo.show.id = 0
  workspace.mobilePane = 'list'
}

function closeModal() {
  modal.value?.onClose?.()
  ui.popBoxList.shift()
}

watch(viewer, host => {
  detachViewer?.()
  detachViewer = host ? setNativeViewerHost(host) : undefined
}, { flush: 'post' })
watch(() => `${shell.activeAccountId ?? ''}:${shell.activeAccount?.status ?? ''}`, () => { void connect() }, { immediate: true, flush: 'sync' })
watch(() => login.status, (status) => {
  if (status && connectingNativeAccountId.value === shell.activeAccountId) readyNativeAccountId.value = connectingNativeAccountId.value
  else if (!status) readyNativeAccountId.value = null
}, { immediate: true, flush: 'sync' })
watch(() => [route.fullPath, login.status, contacts.onMsgList, contacts.groupAssistList, contacts.userList] as const, restoreRoutedConversation, { immediate: true })
watch([unreadCount, unreadOwnerAccountId], ([count, accountId]) => {
  if (!accountId) return
  shell.setAccountUnread(accountId, Number(count) || 0)
}, { immediate: true })
watch(showSettings, (visible) => {
  if (visible) clearNativePopups()
})
watch(() => workspace.activePane, (pane) => {
  if (pane !== 'im') clearNativePopups()
})
watch(() => `${shell.activeAccountId ?? ''}:${chat.chatInfo.show.id}:${chat.chatInfo.show.type}`, () => {
  const current = chat.chatInfo.show
  if (shell.activeAccountId && current.id > 0) assistant.select({
    accountId: shell.activeAccountId, type: current.type === 'group' ? 'group' : 'private',
    peerId: String(current.id), title: current.name || String(current.id),
  })
}, { flush: 'sync' })
onBeforeUnmount(() => {
  ++generation
  detachViewer?.()
  detach?.()
  clearNativePopups()
  resetNativeAccountState()
  selectNativeAccountOptions()
})
</script>

<template>
  <section class="chihiro-native-im" aria-label="消息与联系人">
    <Teleport to="body"><div id="chihiro-im-overlays" /></Teleport>
    <div v-if="showSettings" class="native-options">
      <UserOptions show class="active" :config="settings.sysConfig">
        <template #leading>
          <button type="button" class="native-options-close" aria-label="返回消息" title="返回消息" @click="router.push('/im')">
            <ChevronLeft aria-hidden="true" />
          </button>
        </template>
      </UserOptions>
    </div>
    <div v-show="!showSettings" id="base-app" :class="{ 'native-has-chat': workspace.mobilePane === 'chat', 'native-workbench-list': workspace.listTab === 'workbench' }">
      <aside class="native-list">
        <nav class="workspace-tabs chihiro-inbox-tabs" aria-label="列表工作区">
          <button :class="{ 'is-on': workspace.listTab === 'messages' }" @click="selectList('messages')">
            <span>消息</span>
            <span v-if="unreadCount > 0" class="chihiro-inbox-unread">{{ unreadLabel }}</span>
          </button>
          <button :class="{ 'is-on': workspace.listTab === 'friends' }" @click="selectList('friends')">联系人</button>
          <span class="chihiro-inbox-tabs-spacer" />
          <button :class="{ 'is-on': workspace.listTab === 'workbench' }" @click="selectList('workbench')">工作台</button>
        </nav>
        <div v-show="workspace.listTab === 'workbench'" ref="agentSidebar" class="native-list-content" />
        <div v-show="workspace.listTab !== 'workbench'" class="native-list-content">
        <div v-if="shell.activeAccount?.status !== 'online'" class="native-status">登录 QQ 后查看消息和联系人</div>
        <div v-else-if="nativeAccountConnecting" class="native-status native-loading" role="status"><span class="chihiro-spinner" aria-hidden="true" />正在连接账号…</div>
        <UserFriends v-else-if="imListTab === 'friends'" :key="shell.activeAccountId ?? 'none'" :list="contacts.userList" @user-click="openContactChat" @contact-info="inspectContact" @load-history="loadHistory" />
        <UserMessages v-else :key="shell.activeAccountId ?? 'none'" :chat="chat.chatInfo" @user-click="openContactChat" @load-history="loadHistory" />
        </div>
      </aside>
      <main class="native-chat">
        <button class="workspace-back" @click="workspace.mobilePane = 'list'">返回列表</button>
        <div v-if="workspace.activePane === 'empty'" class="native-thread-content native-status">选择 对话/任务 开始</div>
        <div ref="agentThread" v-show="workspace.activePane === 'agent'" class="native-thread-content" />
        <div v-show="workspace.activePane === 'im'" class="native-thread-content">
        <div v-if="error" class="native-status" role="alert">{{ error }} <button type="button" @click="connect">重新连接</button></div>
        <div v-else-if="!shell.activeAccount || shell.activeAccount.status !== 'online'" class="native-status">账号未连接</div>
        <div v-else-if="nativeAccountConnecting" class="native-status native-loading" role="status"><span class="chihiro-spinner" aria-hidden="true" />正在连接账号…</div>
        <UserSystemNotice v-else-if="chat.chatInfo.show.id < 0" />
        <UserChat v-else-if="hasChat" :key="`${shell.activeAccountId}:${chat.chatInfo.show.type}:${chat.chatInfo.show.id}`" :chat="chat.chatInfo" :list="chat.messageList" :profile-only="profileOnly" @start-chat="sendToContact" @close-profile="closeContactProfile" />
        <div v-else class="native-status">选择 对话/任务 开始</div>
        </div>
      </main>
      <Teleport to="body">
        <TransitionGroup class="app-msg chihiro-global-toast" name="appmsg" tag="div" aria-live="polite">
          <div v-for="item in popList" :key="item.id">
            <span>{{ item.text }}</span>
            <button type="button" aria-label="关闭" @click="popInfo.remove(item.id)">×</button>
          </div>
        </TransitionGroup>
      </Teleport>
      <div v-if="modal" class="pop-box" role="dialog" aria-modal="true" :aria-label="modal.title">
        <div class="pop-box-body ss-card window">
          <header><span>{{ modal.title }}</span><button v-if="modal.allowClose !== false" type="button" aria-label="关闭" @click="closeModal">×</button></header>
          <div v-if="modal.html" v-html="safeModalHtml" />
          <component :is="modal.template" v-else :data="modal.data" v-bind="modal.templateValue" />
          <div class="button"><button v-for="(button, index) in modal.button" :key="index" class="ss-button" :class="{ master: button.master }" @click="button.fun">{{ button.text }}</button></div>
        </div>
      </div>
      <UserFileManager v-if="panelVisible" />
      <UserViewer ref="viewer" />
      <UserTooltips />
    </div>
    <AgentEntry v-if="workspace.agentOpened && agentSidebar && agentThread"
      :sidebar-target="agentSidebar" :thread-target="agentThread" />
  </section>
</template>

<style>
.chihiro-native-im { width:100%; height:100%; min-height:0; color:var(--color-font); --safe-area-top:0px; --safe-area-bottom:0px; --chihiro-list-width:280px; --color-font-3:var(--color-font-2); --color-bg-yellow:color-mix(in srgb, #ffd60a 20%, var(--color-bg)); --color-bg-red:color-mix(in srgb, #ff453a 18%, var(--color-bg)); }
#chihiro-im-overlays { position:fixed; z-index:1100; inset:0; width:0; height:0; overflow:visible; pointer-events:none; }
#chihiro-im-overlays>* { pointer-events:auto; }
.chihiro-native-im #base-app { display:grid; grid-template-columns:280px minmax(0,1fr); overflow:hidden; }
.chihiro-native-im .native-options { position:relative; width:100%; height:100%; min-height:0; overflow:hidden; background:var(--color-bg); }
.chihiro-native-im .native-options>.opt-main { width:100%; height:100%!important; padding:0!important; }
.chihiro-native-im .native-options-close { display:grid; flex:0 0 36px; width:36px; height:36px; place-items:center; margin:0; padding:0; border:0; border-radius:8px; color:var(--color-font-1); background:transparent; cursor:pointer; line-height:0; }
.chihiro-native-im .native-options-close svg { display:block; width:20px; height:20px; stroke-width:2.4; }
.chihiro-native-im .native-options-close:hover { color:var(--color-font); background:rgba(127,127,127,.12); }
.chihiro-native-im .native-list { display:flex; flex-direction:column; min-height:0; border-right:1px solid var(--color-card-2); background:var(--color-card-1); }
.chihiro-native-im .workspace-tabs {
  flex:0 0 52px;
  height:52px;
  box-sizing:border-box;
  padding:0 16px;
  align-items:center;
}
.chihiro-native-im .workspace-tabs button {
  display:inline-flex;
  height:32px;
  align-items:center;
  gap:6px;
  padding:0 0 2px;
}
.chihiro-native-im .chihiro-inbox-unread {
  min-width:16px;
  height:16px;
  padding:0 5px;
  box-sizing:border-box;
  border-radius:999px;
  color:#fff;
  background:#ff3b30;
  font-size:10px;
  font-weight:700;
  line-height:16px;
  text-align:center;
}
.chihiro-native-im .workspace-tabs button.is-on .chihiro-inbox-unread {
  background:rgba(255,255,255,.34);
}
.chihiro-native-im .native-list-content { position:relative; flex:1; min-height:0; overflow:hidden; background:var(--color-card-1); }
.chihiro-native-im .native-list-content .chihiro-list-head .chihiro-inbox-tabs { display:none; }
.chihiro-native-im .native-thread-content { position:absolute; inset:0; min-height:0; }
.chihiro-native-im .workspace-back { display:none; }
.chihiro-native-im .native-chat { min-width:0; min-height:0; position:relative; }
.chihiro-native-im #base-app .friend-view, .chihiro-native-im #base-app .friend-list-container, .chihiro-native-im #base-app .friend-list { width:100% !important; height:100%; min-width:0 !important; }
.chihiro-native-im #base-app .friend-list-space { display:none !important; }
.chihiro-native-im #base-app .chat-pan { position:absolute !important; inset:0 !important; width:100% !important; height:100% !important; margin:0 !important; transform:none !important; }
.chihiro-native-im .native-status { display:flex; height:100%; justify-content:center; align-items:center; gap:12px; color:var(--color-font-2); font-size:14px; }
.chihiro-native-im .native-loading { flex-direction:column; gap:10px; }
.chihiro-native-im .chihiro-spinner { width:24px; height:24px; border:2px solid color-mix(in srgb, var(--color-font-2) 22%, transparent); border-top-color:var(--color-main); border-radius:50%; animation:chihiro-spin .8s linear infinite; }
@keyframes chihiro-spin { to { transform:rotate(1turn); } }
.chihiro-global-toast.app-msg { position:fixed; left:50%; top:16px; right:auto; bottom:auto; transform:translateX(-50%); z-index:3000; display:flex; width:min(480px, calc(100vw - 32px)); height:auto; max-height:calc(100vh - 32px); padding:0 !important; flex-direction:column !important; align-items:center; justify-content:flex-start; gap:8px; pointer-events:none; }
.chihiro-global-toast.app-msg > div { box-sizing:border-box; display:flex; align-items:center; gap:10px; max-width:100%; margin:0; padding:10px 14px 10px 16px; border-radius:8px; background:var(--color-main, #007aff); color:var(--color-font-r, #fff); box-shadow:0 10px 30px rgba(0,0,0,.24); pointer-events:auto; }
.chihiro-global-toast.app-msg > div > span { min-width:0; overflow-wrap:anywhere; }
.chihiro-global-toast.app-msg button { display:grid; width:22px; height:22px; flex:0 0 22px; place-items:center; padding:0; border:0; border-radius:6px; color:inherit; background:rgba(255,255,255,.16); cursor:pointer; font-size:16px; line-height:1; }
.chihiro-global-toast.app-msg button:hover { background:rgba(255,255,255,.24); }
.chihiro-native-im .pop-box-body header { display:flex; justify-content:space-between; }
.chihiro-native-im .pop-box-body,
.chihiro-native-im .ss-card.window {
  background: var(--color-card) !important;
  color: var(--color-font);
  backdrop-filter: none !important;
}
.chihiro-native-im .pop-box-body > div.button {
  background: var(--color-card-1) !important;
}
.chihiro-native-im .forward-pan > div.card,
.chihiro-native-im .user-skin.chat-pan .face-pan,
.chihiro-native-im .user-skin.chat-pan .jin-pan,
.chihiro-native-im .chat-info {
  background: var(--color-card) !important;
  color: var(--color-font);
  backdrop-filter: none !important;
}
@media(max-width:680px) {
  .chihiro-native-im #base-app { grid-template-columns:minmax(0,1fr); }
  .chihiro-native-im .native-options-close { flex-basis:32px; width:32px; height:32px; }
  .chihiro-native-im .native-chat { display:none; }
  .chihiro-native-im .workspace-back { display:block; position:absolute; top:0; left:0; height:32px; z-index:10; padding:4px 12px; color:var(--color-font); background:var(--color-bg); }
  .chihiro-native-im .native-thread-content { top:32px; }
  .chihiro-native-im .native-has-chat .native-list { display:none; }
  .chihiro-native-im .native-has-chat .native-chat { display:block; }
}
</style>
