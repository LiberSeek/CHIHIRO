<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import { useShellStore } from '@/stores/shell'
import { useAssistantStore } from '@/modules/assistant/session'

const route = useRoute()
const shell = useShellStore()
const assistant = useAssistantStore()
onMounted(() => { void shell.refreshAccounts() })
onUnmounted(shell.cancelRefresh)
onUnmounted(assistant.clear)
function selectAccount(event: Event) {
  const id = (event.target as HTMLSelectElement).value
  shell.selectAccount(shell.accounts.find(account => account.id === id)?.id ?? null)
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="brand-mark" aria-label="千寻 AI IM">千寻</div>
      <div class="header-title">
        <strong>AI IM 工作台</strong>
        <span>消息、Agent 与客户运营</span>
      </div>
      <div class="account-context">
        <label for="account-select">当前账号</label>
        <select id="account-select" :value="shell.activeAccountId ?? ''" :disabled="!shell.accounts.length" @change="selectAccount">
          <option v-if="!shell.accounts.length" value="">{{ shell.loading ? '正在加载…' : '暂无账号' }}</option>
          <option v-for="account in shell.accounts" :key="account.id" :value="account.id">
            {{ account.label }} · {{ account.status === 'online' ? '在线' : '离线' }}
          </option>
        </select>
        <button type="button" :disabled="shell.loading" @click="shell.refreshAccounts()">刷新</button>
      </div>
    </header>
    <p v-if="shell.error" class="account-error" role="alert">{{ shell.error }}</p>

    <div class="app-body">
      <nav class="app-nav" aria-label="主导航">
        <RouterLink to="/im" class="nav-link" active-class="is-active">
          <span aria-hidden="true">◉</span>消息
        </RouterLink>
        <RouterLink to="/agent" class="nav-link" :class="{ 'is-active': route.name === 'agent' }">
          <span aria-hidden="true">✦</span>工作台
        </RouterLink>
        <RouterLink to="/assistant" class="nav-link" active-class="is-active">
          <span aria-hidden="true">✎</span>会话助手
        </RouterLink>
      </nav>

      <main class="app-content" :class="{ 'workspace-content': route.name === 'agent' || route.name === 'im' }">
        <RouterView />
      </main>
    </div>
  </div>
</template>
