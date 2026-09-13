<template>
  <header class="user-chat-header">
    <ProviderModelMenu variant="header" />
    <span class="user-chat-context">{{ chatHeader.subtitle || chatHeader.title }}</span>
    <v-btn v-if="chatHeader.projectId" variant="text" icon="mdi-folder-outline"
      :title="tm('workspaceFiles.open')" @click="chatHeader.TOGGLE_WORKSPACE_FILES()" />
  </header>
</template>
<script setup lang="ts">
import ProviderModelMenu from '@/modules/agent/native/source/components/chat/ProviderModelMenu.vue';
import { useChatHeaderStore } from '@/modules/agent/native/source/stores/chatHeader';
import { useModuleI18n } from '@/modules/agent/native/source/i18n/composables';
const chatHeader = useChatHeaderStore();
const { tm } = useModuleI18n('features/chat');
</script>
<style scoped>
.user-chat-header { display: flex; align-items: center; gap: 12px; padding: 0 16px; min-height: 52px; flex-shrink: 0; border-bottom: 1px solid var(--chat-border); }
.user-chat-context { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; opacity: .65; }
</style>
