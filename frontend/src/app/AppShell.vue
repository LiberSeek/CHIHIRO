<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import { useAssistantStore } from '@/modules/assistant/session'
import { useShellStore } from '@/stores/shell'

type ThemeMode = 'light' | 'dark' | 'system'
const themes: ThemeMode[] = ['light', 'dark', 'system']
const labels = { light: '浅色', dark: '深色', system: '跟随系统' }
const shell = useShellStore()
const assistant = useAssistantStore()
const route = useRoute()
const router = useRouter()
const settingsOpen = ref(false)
const themeMode = ref<ThemeMode>('dark')
const media = window.matchMedia('(prefers-color-scheme: dark)')
const themeLabel = computed(() => labels[themeMode.value])

function readTheme(): ThemeMode {
  const saved = localStorage.getItem('chihiro-theme')
  return themes.includes(saved as ThemeMode) ? saved as ThemeMode : 'dark'
}
function applyTheme(mode: ThemeMode) {
  themeMode.value = mode
  localStorage.setItem('chihiro-theme', mode)
  const resolved = mode === 'system' ? (media.matches ? 'dark' : 'light') : mode
  document.documentElement.dataset.theme = resolved
  document.documentElement.dataset.themeMode = mode
  document.documentElement.classList.toggle('bp-dark', resolved === 'dark')
  document.documentElement.classList.toggle('bp-light', resolved === 'light')
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#1c1c1e' : '#f2f2f7')
}
function cycleTheme() {
  applyTheme(themes[(themes.indexOf(themeMode.value) + 1) % themes.length])
}
function selectAccount(id: typeof shell.activeAccountId) {
  shell.selectAccount(id)
  if (router.currentRoute.value.path !== '/im') void router.push('/im')
}
function openImSettings() {
  settingsOpen.value = false
  void router.push(route.path === '/im' && route.query.settings === '1'
    ? { path: '/im' }
    : { path: '/im', query: { settings: '1' } })
}
function closeMenus(event: MouseEvent) {
  if (!(event.target as Element).closest('.shell-settings')) settingsOpen.value = false
}
function onSystemTheme() { if (themeMode.value === 'system') applyTheme('system') }

onMounted(() => {
  applyTheme(readTheme())
  void shell.refreshAccounts()
  document.addEventListener('click', closeMenus)
  media.addEventListener('change', onSystemTheme)
})
onUnmounted(() => {
  shell.cancelRefresh()
  assistant.clear()
  document.removeEventListener('click', closeMenus)
  media.removeEventListener('change', onSystemTheme)
})
</script>

<template>
  <div class="app-shell">
    <nav class="account-rail" aria-label="账号">
      <div class="account-list">
        <button v-for="account in shell.accounts" :key="account.id" type="button" class="account-avatar"
          :class="{ active: account.id === shell.activeAccountId, offline: account.status !== 'online' }"
          :title="`${account.label} · ${account.status === 'online' ? '在线' : '离线'}`" @click="selectAccount(account.id)">
          <img v-if="account.avatar" :src="account.avatar" alt="" referrerpolicy="no-referrer" />
          <span v-else>{{ account.label.slice(0, 1) }}</span>
          <i class="account-state" :class="account.status" aria-hidden="true" />
        </button>
      </div>
      <button class="rail-button add-account" type="button" :disabled="shell.adding" title="添加账号" aria-label="添加账号" @click="shell.addAccount">
        <span v-if="shell.adding" class="rail-spinner" aria-hidden="true" />
        <span v-else aria-hidden="true">+</span>
      </button>
      <div class="rail-space" />
      <button class="rail-button theme-button" type="button" :title="`主题：${themeLabel}`" :aria-label="`主题：${themeLabel}`" @click="cycleTheme">
        <svg v-if="themeMode === 'light'" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17m10-10 1.4-1.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        <svg v-else-if="themeMode === 'dark'" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 15.1A9.5 9.5 0 0 1 8.9 2.4 9.5 9.5 0 1 0 21.6 15.1Z"/></svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="11.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 19.5h8M12 16v3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>
      <div class="shell-settings">
        <button class="rail-button settings-button" :class="{ active: settingsOpen }" type="button" title="设置" aria-label="设置"
          aria-haspopup="menu" :aria-expanded="settingsOpen" @click.stop="settingsOpen = !settingsOpen">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
        <div v-if="settingsOpen" class="settings-menu" role="menu">
          <a href="/webui" target="_blank" rel="noopener" role="menuitem"><span>◌</span>NapCat 设置</a>
          <a href="/astrbot" target="_blank" rel="noopener" role="menuitem"><span>✦</span>AstrBot 设置</a>
          <button type="button" role="menuitem" @click="openImSettings"><span>⚙</span>{{ route.path === '/im' && route.query.settings === '1' ? '返回千寻 IM' : '千寻 IM 设置' }}</button>
        </div>
      </div>
    </nav>

    <main class="app-content">
      <RouterView />
    </main>
    <p v-if="shell.error" class="shell-error" role="alert">{{ shell.error }} <button type="button" @click="shell.refreshAccounts">重试</button></p>
  </div>
</template>
