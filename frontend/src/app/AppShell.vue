<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { Bot, SlidersHorizontal, Settings } from '@lucide/vue'

import ExternalSettingsDialog from '@/app/ExternalSettingsDialog.vue'
import { useAssistantStore } from '@/modules/assistant/session'
import { useShellStore } from '@/stores/shell'
import type { AccountContext, AccountId } from '@/contracts'
import { applyTheme as applyShellTheme, cycleTheme as cycleShellTheme, onThemeChange, readThemeMode, watchSystemTheme, type ThemeMode } from '@/theme'

const labels = { light: '浅色', dark: '深色', system: '跟随系统' }
const shell = useShellStore()
const assistant = useAssistantStore()
const route = useRoute()
const router = useRouter()
const settingsOpen = ref(false)
const externalSettings = ref<{ title: string; src: string } | null>(null)
const accountMenu = ref<{ account: AccountContext; x: number; y: number } | null>(null)
const exitAccount = ref<AccountContext | null>(null)
const clientMenuOpen = ref(false)
const selectedClientId = ref('qq')
const themeMode = ref<ThemeMode>('dark')
const themeLabel = computed(() => labels[themeMode.value])
const loginInProgress = computed(() => shell.adding || shell.pendingAdd || ['starting', 'logging_in', 'qr', 'qr_expired', 'cancelling'].includes(shell.runtimePhase))
const loginNeedsRestart = computed(() => Boolean(shell.activeAccount) && !shell.qrReady
  && /(失效|过期|重新登录|请刷新|错误|超时)/.test(shell.runtimeMessage))
const showLoginPanel = computed(() => route.name === 'im' && route.query.settings !== '1' && route.query.tab !== 'workbench'
  && (loginInProgress.value || !shell.activeAccount || shell.activeAccount.status !== 'online'))
const loginMessage = computed(() => shell.runtimeMessage || (loginInProgress.value
  ? '正在准备登录…'
  : shell.activeAccount
    ? '重新登录后即可继续使用此账号'
    : '点击左侧 + 添加并登录 QQ 账号'))
const showEmptyLauncher = computed(() => !loginInProgress.value && !shell.activeAccount)
const selectedClient = computed(() => shell.clients.find(client => client.id === selectedClientId.value)
  ?? shell.clients.find(client => client.enabled)
  ?? shell.clients[0])
const qrSrc = computed(() => `/api/runtime/qq/qr?v=${shell.qrVersion || Date.now()}`)

function applyTheme(mode: ThemeMode) {
  themeMode.value = applyShellTheme(mode).mode
}
function cycleTheme() {
  themeMode.value = cycleShellTheme().mode
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
function openExternalSettings(title: string, src: string) {
  settingsOpen.value = false
  externalSettings.value = { title, src }
}
function closeMenus(event: MouseEvent) {
  if (!(event.target as Element).closest('.shell-settings')) settingsOpen.value = false
  if (!(event.target as Element).closest('.account-context-menu')) closeAccountMenu()
  if (!(event.target as Element).closest('.client-dropdown')) clientMenuOpen.value = false
}
function selectClient(id: string) {
  const client = shell.clients.find(item => item.id === id)
  if (!client?.enabled) return
  selectedClientId.value = id
  clientMenuOpen.value = false
}
function startSelectedClient() {
  if (!selectedClient.value?.enabled) return
  void shell.addAccount(selectedClient.value.id)
}
onMounted(() => {
  applyTheme(readThemeMode())
  stopTheme = onThemeChange(mode => { themeMode.value = mode })
  watchSystemTheme()
  void shell.refreshAccounts()
  void shell.refreshClients()
  document.addEventListener('click', closeMenus)
  refreshTimer = window.setInterval(() => { void shell.refreshAccounts() }, 1500)
})
let refreshTimer: number | undefined
let stopTheme: (() => void) | undefined
onUnmounted(() => {
  shell.cancelRefresh()
  assistant.clear()
  document.removeEventListener('click', closeMenus)
  stopTheme?.()
  if (refreshTimer !== undefined) window.clearInterval(refreshTimer)
})
</script>

<template>
  <div class="app-shell">
    <nav class="account-rail" aria-label="账号">
      <div class="account-list">
        <button v-for="account in shell.accounts" :key="account.id" type="button" class="account-avatar"
          :class="{ active: account.id === shell.activeAccountId, offline: account.status !== 'online' }"
          :title="`${account.label} · QQ${account.status === 'online' ? ' · 在线' : ' · 离线'}${account.botEnabled ? ' · Bot' : ''} · 右键管理`"
          @click="selectAccount(account.id)" @contextmenu.prevent.stop="openAccountMenu($event, account)">
          <span class="account-avatar-face">
            <img v-if="account.avatar" :src="account.avatar" alt="" referrerpolicy="no-referrer" />
            <span v-else>{{ account.label.slice(0, 1) }}</span>
          </span>
          <span v-if="(account.unread ?? 0) > 0" class="account-unread-badge">{{ account.unread! > 99 ? '99+' : account.unread }}</span>
          <span v-if="account.botEnabled" class="account-bot-badge">BOT</span>
        </button>
      </div>
      <button class="rail-button add-account" type="button" :disabled="shell.adding" title="添加账号" aria-label="添加账号" @click="shell.addAccount()">
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
          <button type="button" role="menuitem" @click="openExternalSettings('NapCat 设置', '/webui')"><SlidersHorizontal :size="16" />NapCat 设置</button>
          <button type="button" role="menuitem" @click="openExternalSettings('AstrBot 设置', '/astrbot')"><Bot :size="16" />AstrBot 设置</button>
          <button type="button" role="menuitem" @click="openImSettings"><Settings :size="16" />{{ route.path === '/im' && route.query.settings === '1' ? '返回千寻 IM' : '千寻 IM 设置' }}</button>
        </div>
      </div>
    </nav>

    <main v-show="!showLoginPanel" class="app-content">
      <RouterView />
    </main>
    <section v-if="showLoginPanel" class="login-panel" aria-label="QQ 登录">
      <div v-if="showEmptyLauncher" class="login-card empty-launcher">
        <div class="empty-title">
          <img class="empty-logo" src="/icon.png" alt="" />
          <h1>千寻</h1>
        </div>
        <p class="empty-tagline">千人千面, 千域千寻</p>
        <div class="launch-row">
          <div class="client-dropdown">
            <button type="button" class="client-drop-button" aria-haspopup="listbox" :aria-expanded="clientMenuOpen" @click.stop="clientMenuOpen = !clientMenuOpen">
              <span class="client-badge">{{ selectedClient?.badge }}</span>
              <span>{{ selectedClient?.name }}</span>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4.2 6.2a.75.75 0 0 1 1.06 0L8 8.94l2.74-2.74a.75.75 0 1 1 1.06 1.06l-3.27 3.27a.75.75 0 0 1-1.06 0L4.2 7.26a.75.75 0 0 1 0-1.06z"/></svg>
            </button>
            <div v-if="clientMenuOpen" class="client-menu" role="listbox">
              <button v-for="client in shell.clients" :key="client.id" type="button" role="option"
                :aria-selected="client.id === selectedClient?.id" :disabled="!client.enabled"
                :class="{ active: client.id === selectedClient?.id }" @click.stop="selectClient(client.id)">
                <span class="client-badge">{{ client.badge }}</span>
                <span>{{ client.name }}{{ client.enabled ? '' : '（即将支持）' }}</span>
              </button>
            </div>
          </div>
          <button type="button" class="launch-button" :disabled="shell.adding || !selectedClient?.enabled" @click="startSelectedClient">启动</button>
        </div>
      </div>
      <div v-else class="login-card">
        <h1>{{ shell.pendingAdd ? '登录新账号' : shell.activeAccount?.status === 'online' ? 'QQ 登录' : '账号未连接' }}</h1>
        <p class="login-brand">千寻IM - 千人千面, 千域千寻</p>
        <img v-if="shell.qrReady" class="login-qr" :src="qrSrc" alt="QQ 登录二维码" />
        <span v-else-if="loginInProgress" class="login-spinner" aria-hidden="true" />
        <p class="login-message">{{ loginMessage }}</p>
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
    <ExternalSettingsDialog
      :open="externalSettings !== null"
      :title="externalSettings?.title ?? ''"
      :src="externalSettings?.src ?? ''"
      @close="externalSettings = null"
    />
    <p v-if="shell.error" class="shell-error" role="alert">{{ shell.error }} <button type="button" @click="shell.refreshAccounts">重试</button></p>
  </div>
</template>
