<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { UserChat } from './native'
import { useCustomizerStore } from './native/source/stores/customizer'
import { useToastStore } from './native/source/stores/toast.js'

const customizer = useCustomizerStore()
const route = useRoute()
const ready = ref(false)
const starting = ref(false)
const startupError = ref('')
let startupController: AbortController | undefined
async function startAgent() {
  startupController?.abort()
  const controller = new AbortController()
  startupController = controller
  starting.value = true
  startupError.value = ''
  try {
    const response = await fetch('/api/runtime/bot/ensure', { method: 'POST', signal: controller.signal })
    const result = await response.json()
    if (!response.ok || result.error) throw new Error(result.message || 'Agent 启动失败')
    if (!controller.signal.aborted) ready.value = true
  } catch (error) {
    if (!controller.signal.aborted) startupError.value = error instanceof Error ? error.message : 'Agent 连接失败'
  } finally {
    if (!controller.signal.aborted) starting.value = false
  }
}
onMounted(startAgent)
onBeforeUnmount(() => startupController?.abort())
const mobilePane = ref<'list' | 'chat'>(route.params.conversationId ? 'chat' : 'list')
watch(() => route.params.conversationId, () => { mobilePane.value = 'chat' })
const toast = useToastStore()
const currentToast = computed(() => toast.current as {
  message: string; color: string; timeout: number; multiLine: boolean; closable: boolean
} | undefined)
const snackbarOpen = computed({ get: () => !!currentToast.value, set: (value) => { if (!value) toast.shift() } })
onBeforeUnmount(() => { while (toast.current) toast.shift() })
</script>

<template>
  <section class="agent-module" :class="`mobile-${mobilePane}`" aria-label="Agent 工作台">
    <div class="agent-mobile-tabs" aria-label="工作台区域">
      <button type="button" :aria-pressed="mobilePane === 'list'" @click="mobilePane = 'list'">会话列表</button>
      <button type="button" :aria-pressed="mobilePane === 'chat'" @click="mobilePane = 'chat'">聊天</button>
    </div>
    <v-app class="agent-v-app" :theme="customizer.uiTheme">
      <UserChat v-if="ready" :chihiro-hosted="true">
        <template #workspace-tabs>
          <nav class="workspace-list-tabs" aria-label="列表工作区">
            <RouterLink to="/im">消息</RouterLink>
            <RouterLink to="/im?tab=contacts">联系人</RouterLink>
            <RouterLink to="/agent" aria-current="page">工作台</RouterLink>
          </nav>
        </template>
      </UserChat>
      <div v-else class="agent-startup" role="status">
        <p>{{ starting ? '正在连接 Agent…' : startupError }}</p>
        <button v-if="!starting" type="button" @click="startAgent">重试连接</button>
      </div>
      <v-snackbar v-if="currentToast" v-model="snackbarOpen" :color="currentToast.color"
        :timeout="currentToast.timeout" :multi-line="currentToast.multiLine" location="top center">
        {{ currentToast.message }}
        <template v-if="currentToast.closable" #actions>
          <v-btn variant="text" @click="snackbarOpen = false">关闭</v-btn>
        </template>
      </v-snackbar>
    </v-app>
  </section>
</template>

<style scoped>
.agent-module { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }
.workspace-list-tabs { display:flex; gap:18px; padding:12px 16px; border-bottom:1px solid #ddd; font-size:13px; }
.workspace-list-tabs a { color:inherit; text-decoration:none; padding-bottom:5px; }
.workspace-list-tabs a:last-child { margin-left:auto; border-bottom:2px solid #007aff; }
.agent-v-app { width: 100%; height: 100%; min-height: 0; flex: 1; }
.agent-mobile-tabs { display: none; }
.agent-startup { display: grid; align-content: center; justify-items: center; gap: 16px; height: 100%; }
.agent-startup button { padding: 8px 16px; border: 1px solid currentColor; border-radius: 6px; }
.agent-v-app :deep(.v-application__wrap) { min-height: 0; height: 100%; }
.agent-v-app :deep(.chat-ui) { display: grid; grid-template-columns: 280px minmax(0, 1fr); width: 100%; height: 100%; min-height: 0; }
.agent-v-app :deep(.native-chat-sidebar-root),
.agent-v-app :deep(.native-chat-main-root) { position: relative; min-width: 0; min-height: 0; height: 100%; overflow: hidden; }
@media (max-width: 760px) {
  .agent-mobile-tabs { display: flex; gap: 8px; padding: 8px; background: #172338; }
  .agent-mobile-tabs button { padding: 6px 12px; color: #bdcce2; border-radius: 5px; }
  .agent-mobile-tabs button[aria-pressed="true"] { color: #d8fff2; background: #1f4e4a; }
  .agent-v-app :deep(.chat-ui) { grid-template-columns: minmax(0, 1fr); }
  .mobile-list :deep(.native-chat-main-root),
  .mobile-chat :deep(.native-chat-sidebar-root) { display: none; }
}
</style>
