<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView } from 'vue-router'

import { useShellStore } from '@/stores/shell'

const shell = useShellStore()
const accountLabel = computed(() => shell.activeAccountId ?? '未选择账号')
shell.refreshAccounts().catch(() => undefined)
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="brand-mark" aria-label="千寻 AI IM">千寻</div>
      <div class="header-title">
        <strong>AI IM 工作台</strong>
        <span>消息、Agent 与客户运营</span>
      </div>
      <div class="account-context" aria-label="当前账号">{{ accountLabel }}</div>
    </header>

    <div class="app-body">
      <nav class="app-nav" aria-label="主导航">
        <RouterLink to="/im" class="nav-link" active-class="is-active">
          <span aria-hidden="true">◉</span>消息
        </RouterLink>
        <RouterLink to="/agent" class="nav-link" active-class="is-active">
          <span aria-hidden="true">✦</span>工作台
        </RouterLink>
        <RouterLink to="/assistant" class="nav-link" active-class="is-active">
          <span aria-hidden="true">✎</span>会话助手
        </RouterLink>
      </nav>

      <main class="app-content">
        <RouterView />
      </main>
    </div>
  </div>
</template>
