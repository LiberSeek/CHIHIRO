<template>
  <header class="user-chat-header">
    <button type="button" class="user-chat-back" aria-label="返回" title="返回" @click="goBack">
      <v-icon icon="mdi-chevron-left" size="20" />
    </button>
    <span class="user-chat-context">{{ chatHeader.subtitle || chatHeader.title }}</span>
    <v-btn v-if="chatHeader.projectId" variant="text" icon="mdi-folder-outline"
      :title="tm('workspaceFiles.open')" @click="chatHeader.TOGGLE_WORKSPACE_FILES()" />
    <slot name="actions" />
  </header>
</template>
<script setup lang="ts">
import { useChatHeaderStore } from '@/modules/agent/native/src/stores/chatHeader';
import { useModuleI18n } from '@/modules/agent/native/src/i18n/composables';
import { useAgentNavigation } from '@/modules/agent/native/src/navigation';
const chatHeader = useChatHeaderStore();
const { tm } = useModuleI18n('features/chat');
const navigation = useAgentNavigation();
function goBack() { navigation.backToWorkspace(); }
</script>
<style scoped>
.user-chat-header { display: flex; align-items: center; gap: 12px; height: 52px; min-height: 52px; box-sizing: border-box; padding: 0 16px; flex-shrink: 0; border-bottom: 1px solid var(--chat-border); }
.user-chat-back { display: grid; width: 32px; height: 32px; flex: 0 0 32px; place-items: center; padding: 0; border: 0; border-radius: 50%; color: rgb(var(--v-theme-on-surface)); background: transparent; cursor: pointer; }
.user-chat-back:hover { background: rgba(var(--v-theme-on-surface), 0.08); }
.user-chat-context { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; opacity: .65; }
</style>
