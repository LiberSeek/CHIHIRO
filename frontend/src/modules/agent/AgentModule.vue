<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useShellStore } from '@/stores/shell'
import AgentSidebar from './AgentSidebar.vue'
import AgentThread from './AgentThread.vue'
import { createAgentWorkspace, provideAgentWorkspace, type AgentWorkspaceOptions } from './useAgentWorkspace'
const props = withDefaults(defineProps<AgentWorkspaceOptions>(), { apiBase: '/astrbot/api/v1', workspaceId: 'default' })
const shell = useShellStore()
const workspace = createAgentWorkspace({ ...props, accountId: props.accountId ?? shell.activeAccountId ?? undefined })
provideAgentWorkspace(workspace)
const mobileSidebar = ref(false)
const activeTitle = computed(() => workspace.activeSession.value?.display_name || '新会话')
onMounted(() => workspace.load())
</script>
<template>
  <section class="agent-module" aria-label="AstrBot Agent 工作台">
    <AgentSidebar :mobile-open="mobileSidebar" @close="mobileSidebar = false" />
    <div class="agent-content">
      <header class="agent-header">
        <button class="mobile-menu" type="button" aria-label="打开会话列表" @click="mobileSidebar = true">☰</button>
        <div class="agent-title"><span class="agent-kicker">ASTRBOT AGENT</span><strong>{{ activeTitle }}</strong></div>
        <label class="model-select">模型<select v-model="workspace.selectedModel.value" aria-label="选择模型"><option value="">默认模型</option><option v-for="model in workspace.models.value" :key="model" :value="model">{{ model }}</option></select></label>
      </header>
      <AgentThread />
    </div>
  </section>
</template>
<style scoped>
.agent-module { display: flex; height: 100%; min-height: 560px; overflow: hidden; border: 1px solid #26344a; border-radius: 14px; background: #101a2a; color: #e8effa; }
.agent-content { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.agent-header { display: flex; align-items: center; gap: 14px; min-height: 64px; padding: 0 22px; border-bottom: 1px solid #26344a; background: #141f31; }
.agent-title { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 4px; }
.agent-title strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; }
.agent-kicker { color: #79dfc1; font-size: 10px; font-weight: 700; letter-spacing: .14em; }
.model-select { display: flex; align-items: center; gap: 8px; color: #899bb6; font-size: 11px; }
.model-select select { max-width: 190px; padding: 7px 10px; border: 1px solid #32445e; border-radius: 7px; background: #18263a; color: #dbe6f6; }
.mobile-menu { display: none; border: 0; background: none; color: #c6d4e8; font-size: 20px; }
@media (max-width: 720px) { .agent-module { border-radius: 0; border-inline: 0; } .mobile-menu { display: block; } .model-select { display: none; } }
</style>
