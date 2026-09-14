<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import { onThemeChange } from '@/theme'
import { UserChat } from './native'
import { useCustomizerStore } from './native/src/stores/customizer'
import { useToastStore } from './native/src/stores/toast.js'
import { createHostedAgentNavigation, agentNavigationKey } from './native/src/navigation'
import { useWorkspace } from '@/modules/workspace/workspace'
import { useRouter } from 'vue-router'

const customizer = useCustomizerStore()
const workspace = useWorkspace()
const router = useRouter()
provide(agentNavigationKey, createHostedAgentNavigation(router, workspace))
defineProps<{ sidebarTarget: HTMLElement; threadTarget: HTMLElement }>()
const ready = ref(false)
const starting = ref(false)
const startupError = ref('')
let startupController: AbortController | undefined
let stopTheme: (() => void) | undefined
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
onMounted(() => {
  customizer.SYNC_THEME()
  stopTheme = onThemeChange(() => customizer.SYNC_THEME())
  void startAgent()
})
onBeforeUnmount(() => {
  stopTheme?.()
  startupController?.abort()
})
const toast = useToastStore()
const currentToast = computed(() => toast.current as {
  message: string; color: string; timeout: number; multiLine: boolean; closable: boolean
} | undefined)
const snackbarOpen = computed({ get: () => !!currentToast.value, set: (value) => { if (!value) toast.shift() } })
onBeforeUnmount(() => { while (toast.current) toast.shift() })
</script>

<template>
  <section class="agent-module" aria-label="Agent">
    <v-app class="agent-v-app" :theme="customizer.uiTheme">
      <UserChat v-if="ready" chihiro-hosted :sidebar-target="sidebarTarget" :thread-target="threadTarget" />
      <Teleport v-else :to="sidebarTarget">
        <div class="agent-startup" role="status">
          <p>{{ starting ? '正在连接 Agent…' : startupError }}</p>
          <button v-if="!starting" type="button" @click="startAgent">重试连接</button>
        </div>
      </Teleport>
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
.agent-module { position:absolute; width:0; height:0; }
.agent-v-app { background:transparent; }
.agent-v-app :deep(.v-application__wrap) { min-height:0; }
.agent-startup { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:12px; }
.agent-startup button { padding:8px 16px; border:1px solid currentColor; border-radius:6px; }
</style>
