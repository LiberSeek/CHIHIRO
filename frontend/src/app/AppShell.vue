<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import { useAssistantStore } from '@/modules/assistant/session'
import { useShellStore } from '@/stores/shell'
import type { AccountContext, AccountId } from '@/contracts'

type ThemeMode = 'light' | 'dark' | 'system'
const themes: ThemeMode[] = ['light', 'dark', 'system']
const labels = { light: '浅色', dark: '深色', system: '跟随系统' }
const shell = useShellStore()
const assistant = useAssistantStore()
const route = useRoute()
const router = useRouter()
const settingsOpen = ref(false)
const accountMenu = ref<{ account: AccountContext; x: number; y: number } | null>(null)
const exitAccount = ref<AccountContext | null>(null)
const themeMode = ref<ThemeMode>('dark')
const media = window.matchMedia('(prefers-color-scheme: dark)')
const themeLabel = computed(() => labels[themeMode.value])
const loginInProgress = computed(() => shell.adding || shell.pendingAdd || ['starting', 'logging_in', 'qr', 'qr_expired', 'cancelling'].includes(shell.runtimePhase))
const loginNeedsRestart = computed(() => Boolean(shell.activeAccount) && !shell.qrReady
  && /(失效|过期|重新登录|请刷新|错误|超时)/.test(shell.runtimeMessage))
const showLoginPanel = computed(() => route.name === 'im' && route.query.settings !== '1' && route.query.tab !== 'workbench'
  && (loginInProgress.value || Boolean(shell.activeAccount && shell.activeAccount.status !== 'online')))
const qrSrc = computed(() => `/api/runtime/qq/qr?v=${shell.qrVersion || Date.now()}`)

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
function selectAccount(id: AccountId) {
  closeAccountMenu()
  shell.selectAccount(id)
  if (router.currentRoute.value.path !== '/im') void router.push('/im')
}
function openAccountMenu(event: MouseEvent, account: AccountContext) {
  settingsOpen.value = false
  accountMenu.value = {
    account,
    x: Math.min(event.clientX, window.innerWidth - 196),
    y: Math.min(event.clientY, window.innerHeight - 116),
  }
}
function closeAccountMenu() { accountMenu.value = null }
function relogin(account: AccountContext, refreshQr = false) {
  closeAccountMenu()
  void shell.reloginAccount(account.id, refreshQr)
}
function askExit(account: AccountContext) {
  closeAccountMenu()
  exitAccount.value = account
}
async function confirmExit() {
  const account = exitAccount.value
  if (!account) return
  const removed = await shell.removeAccount(account.id)
  if (removed) exitAccount.value = null
}
function openImSettings() {
  settingsOpen.value = false
  void router.push(route.path === '/im' && route.query.settings === '1'
    ? { path: '/im' }
    : { path: '/im', query: { settings: '1' } })
}
function closeMenus(event: MouseEvent) {
  if (!(event.target as Element).closest('.shell-settings')) settingsOpen.value = false
  if (!(event.target as Element).closest('.account-context-menu')) closeAccountMenu()
}
function onSystemTheme() { if (themeMode.value === 'system') applyTheme('system') }

onMounted(() => {
  applyTheme(readTheme())
  void shell.refreshAccounts()
  document.addEventListener('click', closeMenus)
  media.addEventListener('change', onSystemTheme)
  refreshTimer = window.setInterval(() => { void shell.refreshAccounts() }, 1500)
})
let refreshTimer: number | undefined
onUnmounted(() => {
  shell.cancelRefresh()
  assistant.clear()
  document.removeEventListener('click', closeMenus)
  media.removeEventListener('change', onSystemTheme)
  if (refreshTimer !== undefined) window.clearInterval(refreshTimer)
})
</script>

<template>
  <div class="app-shell">
    <nav class="account-rail" aria-label="账号">
      <div class="account-list">
        <button v-for="account in shell.accounts" :key="account.id" type="button" class="account-avatar"
          :class="{ active: account.id === shell.activeAccountId, offline: account.status !== 'online' }"
          :title="`${account.label} · ${account.status === 'online' ? '在线' : '离线'} · 右键管理`"
          @click="selectAccount(account.id)" @contextmenu.prevent.stop="openAccountMenu($event, account)">
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
    <section v-if="showLoginPanel" class="login-panel" aria-label="QQ 登录">
      <div class="login-card">
        <h1>{{ shell.pendingAdd ? '登录新账号' : shell.activeAccount?.status === 'online' ? 'QQ 登录' : '账号未连接' }}</h1>
        <p class="login-brand">千寻IM - 千人千面, 千域千寻</p>
        <img v-if="shell.qrReady" class="login-qr" :src="qrSrc" alt="QQ 登录二维码" />
        <span v-else-if="loginInProgress" class="login-spinner" aria-hidden="true" />
        <p class="login-message">{{ shell.runtimeMessage || (loginInProgress ? '正在准备登录…' : '重新登录后即可继续使用此账号') }}</p>
        <div class="login-actions">
          <button v-if="(!loginInProgress || loginNeedsRestart) && shell.activeAccount" type="button" class="primary" :disabled="shell.accountAction" @click="relogin(shell.activeAccount, loginNeedsRestart)">重新登录</button>
          <button v-if="shell.qrReady || loginNeedsRestart" type="button" :disabled="shell.accountAction" @click="shell.refreshLoginQr">刷新二维码</button>
          <button v-if="loginInProgress" type="button" @click="shell.cancelLogin">取消登录</button>
          <button v-if="!loginInProgress && shell.activeAccount" type="button" class="danger" @click="askExit(shell.activeAccount)">退出账号</button>
        </div>
      </div>
    </section>
    <div v-if="accountMenu" class="account-context-menu" :style="{ left: `${accountMenu.x}px`, top: `${accountMenu.y}px` }" @click.stop>
      <button type="button" @click="relogin(accountMenu.account)">{{ accountMenu.account.status === 'online' ? '重新登录' : '登录账号' }}</button>
      <button type="button" class="danger" @click="askExit(accountMenu.account)">退出账号</button>
    </div>
    <div v-if="exitAccount" class="shell-dialog" role="dialog" aria-modal="true" aria-labelledby="exit-account-title" @click.self="exitAccount = null">
      <div class="shell-dialog-card">
        <h2 id="exit-account-title">退出账号</h2>
        <p>确定退出“{{ exitAccount.label }}”吗？该账号的隔离运行数据会被删除，其他账号不受影响。</p>
        <div><button type="button" @click="exitAccount = null">取消</button><button type="button" class="danger" :disabled="shell.accountAction" @click="confirmExit">退出账号</button></div>
      </div>
    </div>
    <p v-if="shell.error" class="shell-error" role="alert">{{ shell.error }} <button type="button" @click="shell.refreshAccounts">重试</button></p>
  </div>
</template>
