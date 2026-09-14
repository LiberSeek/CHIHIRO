<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AssistantPanel from './AssistantPanel.vue'
import { useAssistantStore } from './session'
const assistant = useAssistantStore()
</script>

<template>
  <section class="assistant-workspace" aria-label="会话助手">
    <template v-if="assistant.context">
      <RouterLink to="/im">返回消息</RouterLink>
      <AssistantPanel />
    </template>
    <div v-else class="assistant-empty"><h1>会话助手</h1><p>尚未选择会话</p><RouterLink to="/im">打开消息</RouterLink></div>
  </section>
</template>

<style scoped>
.assistant-workspace { height:100%; color:#253337; background:white; }
.assistant-workspace>a { display:inline-block; padding:12px; color:#177568; }
.assistant-workspace :deep(.assistant-panel) { max-height:calc(100% - 48px); }
.assistant-empty { padding:24px; }
.assistant-empty h1 { font-size:20px; }
.assistant-empty a { color:#177568; }
</style>
