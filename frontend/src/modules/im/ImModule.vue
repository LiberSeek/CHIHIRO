<script setup lang="ts">
import { computed, inject, onBeforeUnmount, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import DOMPurify from 'dompurify'
import { useShellStore } from '@/stores/shell'
import { accountSessionManagerKey } from '@/services/account-session-host'
import { Connector, login } from './native/src/function/connect'
import { resetNativeAccountState } from './native/reset'
import { selectNativeAccountOptions } from './native/src/function/option'
import { useAuthStore } from './native/src/state/auth'
import { useChatStore } from './native/src/state/chat'
import { useContactStore } from './native/src/state/contact'
import { useUIStore } from './native/src/state/ui'
import { loadHistory } from './native/src/function/utils/appUtil'
import { PopInfo, popList } from './native/src/function/base'
import type { BaseChatInfoElem } from './native/src/function/elements/information'
import UserMessages from './native/src/pages/user/UserMessages.vue'
import UserFriends from './native/src/pages/user/UserFriends.vue'
import UserChat from './native/src/pages/user/UserChat.vue'
import UserSystemNotice from './native/src/pages/user/UserSystemNotice.vue'
import UserViewer from './native/src/components/user/UserViewerCom.vue'
import UserTooltips from './native/src/components/user/tooltip/UserTooltips.vue'
import UserFileManager, { panelVisible } from './native/src/components/user/UserFileManager.vue'

const sessions = inject(accountSessionManagerKey)!
const shell = useShellStore()
const route = useRoute()
const chat = useChatStore()
const contacts = useContactStore()
const auth = useAuthStore()
const ui = useUIStore()
const viewer = ref<InstanceType<typeof UserViewer>>()
provide('viewer', { viewer })
const error = ref('')
let generation = 0
let detach: (() => void) | undefined
const hasChat = computed(() => chat.chatInfo.show.id !== 0)
const modal = computed(() => ui.popBoxList[0])
const safeModalHtml = computed(() => DOMPurify.sanitize(modal.value?.html ?? ''))
const popInfo = new PopInfo()

async function connect() {
  const current = ++generation
  detach?.()
  detach = undefined
  resetNativeAccountState()
  error.value = ''
  const account = shell.activeAccount
  selectNativeAccountOptions(account?.id)
  if (!account || account.status !== 'online') return
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

function changeChat(info: BaseChatInfoElem) {
  chat.chatInfo = {
    show: info,
    info: { group_info: {}, user_info: {}, me_info: {}, group_members: [],
      group_files: {}, group_sub_files: {}, jin_info: { list: [], pages: 0 } },
  }
  chat.messageList = []
  chat.mergeMessageList = undefined
  ui.canLoadHistory = true
  ui.loadHistoryFail = false
  if (info.type === 'group') {
    Connector.send('get_group_member_info', { group_id: info.id, user_id: auth.loginInfo.uin }, 'getUserInfoInGroup')
    Connector.send('get_group_member_list', { group_id: info.id, no_cache: true }, 'getGroupMemberList')
  }
}

function closeModal() {
  modal.value?.onClose?.()
  ui.popBoxList.shift()
}

watch(() => [shell.activeAccountId, shell.activeAccount?.status], () => { void connect() }, { immediate: true, flush: 'sync' })
onBeforeUnmount(() => {
  ++generation
  detach?.()
  resetNativeAccountState()
  selectNativeAccountOptions()
})
</script>

<template>
  <section class="chihiro-native-im bp-light" aria-label="消息与联系人">
    <Teleport to="body"><div id="chihiro-im-overlays" class="bp-light" /></Teleport>
    <div id="base-app" :class="{ 'native-has-chat': hasChat }">
      <aside class="native-list">
        <UserFriends v-if="route.query.tab === 'contacts'" :key="shell.activeAccountId ?? 'none'" :list="contacts.userList" @user-click="changeChat" @load-history="loadHistory" />
        <UserMessages v-else :key="shell.activeAccountId ?? 'none'" :chat="chat.chatInfo" @user-click="changeChat" @load-history="loadHistory" />
      </aside>
      <main class="native-chat">
        <div v-if="error" class="native-status" role="alert">{{ error }} <button type="button" @click="connect">重新连接</button></div>
        <div v-else-if="!shell.activeAccount || shell.activeAccount.status !== 'online'" class="native-status">账号未连接</div>
        <div v-else-if="!login.status" class="native-status" role="status">正在连接账号…</div>
        <UserSystemNotice v-else-if="chat.chatInfo.show.id < 0" />
        <UserChat v-else-if="hasChat" :key="`${shell.activeAccountId}:${chat.chatInfo.show.type}:${chat.chatInfo.show.id}`" :chat="chat.chatInfo" :list="chat.messageList" />
        <div v-else class="native-status">选择联系人开始聊天</div>
      </main>
      <div class="app-msg" aria-live="polite"><div v-for="item in popList" :key="item.id"><span>{{ item.text }}</span><button type="button" aria-label="关闭" @click="popInfo.remove(item.id)">×</button></div></div>
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
  </section>
</template>

<style>
.chihiro-native-im { width:100%; height:100%; min-height:0; color:var(--color-font); --safe-area-top:0px; --safe-area-bottom:0px; --chihiro-list-width:280px; --color-font-3:#a6a6a6; --color-bg-yellow:#fff7d9; --color-bg-red:#ffe5e5; }
.chihiro-native-im #base-app { display:grid; grid-template-columns:280px minmax(0,1fr); overflow:hidden; }
.chihiro-native-im .native-list { min-height:0; border-right:1px solid #e5e5e5; }
.chihiro-native-im .native-chat { min-width:0; min-height:0; position:relative; }
.chihiro-native-im #base-app .friend-view, .chihiro-native-im #base-app .friend-list-container, .chihiro-native-im #base-app .friend-list { width:100% !important; height:100%; min-width:0 !important; }
.chihiro-native-im #base-app .friend-list-space { display:none !important; }
.chihiro-native-im #base-app .chat-pan { position:absolute !important; inset:0 !important; width:100% !important; height:100% !important; margin:0 !important; transform:none !important; }
.chihiro-native-im .native-status { display:flex; height:100%; justify-content:center; align-items:center; gap:12px; color:#777; font-size:14px; }
.chihiro-native-im .app-msg { position:absolute; bottom:12px; left:12px; z-index:30; }
.chihiro-native-im .pop-box-body header { display:flex; justify-content:space-between; }
@media(max-width:680px) {
  .chihiro-native-im #base-app { grid-template-columns:minmax(0,1fr); }
  .chihiro-native-im .native-chat { display:none; }
  .chihiro-native-im .native-has-chat .native-list { display:none; }
  .chihiro-native-im .native-has-chat .native-chat { display:block; }
}
</style>
