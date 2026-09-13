<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { UserChat } from './native'
import { useCustomizerStore } from './native/source/stores/customizer'
import { useToastStore } from './native/source/stores/toast.js'

const customizer = useCustomizerStore()
const route = useRoute()
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
      <UserChat :chihiro-hosted="true" />
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
.agent-v-app { width: 100%; height: 100%; min-height: 0; flex: 1; }
.agent-mobile-tabs { display: none; }
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
