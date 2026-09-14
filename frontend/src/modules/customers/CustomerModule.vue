<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { useCustomerStore } from './customer-store'
import type { CustomerEvidence } from './customer-client'

const store = useCustomerStore()
const search = ref(store.query)
const draft = ref({ displayName: '', tags: '', notes: '' })
const mobileDetail = computed(() => Boolean(store.selectedId))

watch(() => store.customer, customer => {
  draft.value = customer
    ? { displayName: customer.displayName, tags: customer.tags.join(', '), notes: customer.notes }
    : { displayName: '', tags: '', notes: '' }
}, { immediate: true })
onBeforeUnmount(store.clear)

function submitSearch() { void store.loadList(search.value) }
function select(id: string) { void store.select(id) }
function save() {
  const tags = Array.from(new Set(draft.value.tags.split(',').map(tag => tag.trim()).filter(Boolean)))
  void store.save({ displayName: draft.value.displayName.trim(), tags, notes: draft.value.notes.trim() })
}
function formatTime(value?: number) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(value) : '暂无时间'
}
function sourceLabel(source: CustomerEvidence) { return `会话 ${source.conversationId} · 消息 ${source.messageId}` }
</script>

<template>
  <section class="customer-module" :class="{ 'showing-detail': mobileDetail }" aria-label="客户资料">
    <aside class="customer-list-pane">
      <header class="module-heading">
        <p class="eyebrow">CUSTOMER INSIGHTS</p>
        <h1>客户资料</h1>
        <p>按当前 QQ 账号查看从真实会话中整理的客户线索。</p>
      </header>
      <form class="customer-search" @submit.prevent="submitSearch">
        <input v-model="search" type="search" placeholder="搜索姓名、标签、备注或 QQ" aria-label="搜索客户" :disabled="!store.activeAccountId || store.listLoading" />
        <button type="submit" :disabled="!store.activeAccountId || store.listLoading">搜索</button>
      </form>
      <p v-if="!store.activeAccountId" class="customer-state">请选择已登录的 QQ 账号。</p>
      <div v-else-if="store.listLoading" class="customer-state" role="status">正在加载客户资料…</div>
      <div v-else-if="store.listError" class="customer-state is-error" role="alert">{{ store.listError }} <button type="button" @click="submitSearch">重试</button></div>
      <div v-else-if="!store.customers.length" class="customer-state">{{ store.query ? '没有匹配的客户资料。' : '此账号还没有可用的客户资料。' }}</div>
      <ol v-else class="customer-list" :aria-label="`客户列表，共 ${store.total} 位`">
        <li v-for="item in store.customers" :key="item.id">
          <button type="button" class="customer-row" :class="{ selected: item.id === store.selectedId }" :aria-current="item.id === store.selectedId ? 'true' : undefined" @click="select(item.id)">
            <strong>{{ item.displayName || item.peerId }}</strong>
            <span>{{ item.channel }} · {{ item.peerId }}</span>
            <span v-if="item.topIntent" class="intent-chip">{{ item.topIntent.label }}</span>
            <small>{{ item.openIntentCount }} 项待跟进 · {{ formatTime(item.lastEvidenceAt) }}</small>
          </button>
        </li>
      </ol>
    </aside>

    <article class="customer-detail-pane">
      <div v-if="!store.activeAccountId" class="detail-state">选择账号后即可查看客户详情。</div>
      <div v-else-if="store.detailLoading" class="detail-state" role="status">正在加载客户详情…</div>
      <div v-else-if="store.detailError" class="detail-state is-error" role="alert">{{ store.detailError }} <button type="button" @click="select(store.selectedId)">重试</button></div>
      <div v-else-if="!store.customer" class="detail-state">从左侧选择一位客户，查看事实、意向和证据。</div>
      <template v-else>
        <header class="detail-header">
          <button type="button" class="back-button" @click="store.select('')">‹ 客户列表</button>
          <p class="eyebrow">{{ store.customer.channel }} · {{ store.customer.peerType || 'person' }}</p>
          <h2>{{ store.customer.displayName || store.customer.peerId }}</h2>
          <p>{{ store.customer.peerId }} · 最近证据 {{ formatTime(store.customer.lastEvidenceAt) }}</p>
        </header>
        <form class="customer-editor" @submit.prevent="save">
          <label>显示名称<input v-model="draft.displayName" maxlength="160" :disabled="store.saving" /></label>
          <label>标签 <span>用逗号分隔</span><input v-model="draft.tags" maxlength="512" :disabled="store.saving" /></label>
          <label>运营备注<textarea v-model="draft.notes" rows="3" maxlength="5000" :disabled="store.saving" /></label>
          <p v-if="store.saveError" class="form-error" role="alert">{{ store.saveError }}</p>
          <button class="save-button" type="submit" :disabled="store.saving">{{ store.saving ? '正在保存…' : '保存资料' }}</button>
        </form>
        <section class="insight-section">
          <h3>已知事实 <small>{{ store.customer.facts.length }}</small></h3>
          <p v-if="!store.customer.facts.length" class="empty-insight">暂无从会话提取的事实。</p>
          <ul v-else class="insight-list">
            <li v-for="fact in store.customer.facts" :key="fact.id"><strong>{{ fact.kind }}</strong><span>{{ fact.value }}</span><small v-if="fact.confidence !== undefined">可信度 {{ Math.round(fact.confidence * 100) }}%</small></li>
          </ul>
        </section>
        <section class="insight-section">
          <h3>客户意向 <small>{{ store.customer.intents.length }}</small></h3>
          <p v-if="!store.customer.intents.length" class="empty-insight">暂无客户意向。</p>
          <ul v-else class="insight-list">
            <li v-for="intent in store.customer.intents" :key="intent.id"><strong>{{ intent.label }}</strong><span>{{ intent.kind }} · {{ intent.status || 'open' }}</span><small v-if="intent.score !== undefined">评分 {{ Math.round(intent.score * 100) }}%</small></li>
          </ul>
        </section>
        <section class="insight-section evidence-section">
          <h3>来源证据 <small>{{ store.customer.evidence.length }}</small></h3>
          <p v-if="!store.customer.evidence.length" class="empty-insight">暂无可追溯的消息证据。</p>
          <ol v-else class="evidence-list">
            <li v-for="source in store.customer.evidence" :key="source.id || `${source.conversationId}:${source.messageId}`">
              <RouterLink :to="{ path: '/im', query: { conversationId: source.conversationId, messageId: source.messageId } }">{{ sourceLabel(source) }}</RouterLink>
              <time>{{ formatTime(source.messageAt || source.observedAt) }}</time>
              <p v-if="source.text">{{ source.text }}</p>
            </li>
          </ol>
        </section>
      </template>
    </article>
  </section>
</template>

<style scoped>
.customer-module { display:grid; grid-template-columns:minmax(280px, 360px) minmax(0, 1fr); min-height:100%; color:#dce7f6; border:1px solid #2a3b54; border-radius:16px; overflow:hidden; background:#172338; box-shadow:0 24px 80px rgb(0 0 0 / 20%); }
.customer-list-pane { min-height:0; border-right:1px solid #2a3b54; background:#131e30; }
.module-heading { padding:28px 24px 16px; }.module-heading h1,.detail-header h2 { margin:0; font-size:26px; letter-spacing:-.03em; }.module-heading p:not(.eyebrow),.detail-header>p:not(.eyebrow) { margin:8px 0 0; color:#91a4c0; line-height:1.5; font-size:13px; }
.customer-search { display:flex; gap:8px; padding:0 18px 18px; }.customer-search input,.customer-editor input,.customer-editor textarea { min-width:0; width:100%; border:1px solid #3a4e6d; border-radius:7px; padding:9px 10px; background:#0f1828; color:inherit; font:inherit; }.customer-search button,.save-button,.customer-state button,.detail-state button,.back-button { border:1px solid #426281; border-radius:7px; padding:8px 10px; background:#1f4e4a; color:#d8fff2; cursor:pointer; font:inherit; white-space:nowrap; }.customer-search button:disabled,.save-button:disabled { cursor:wait; opacity:.55; }
.customer-state,.detail-state { padding:24px; color:#9eb0ca; font-size:14px; line-height:1.5; }.is-error,.form-error { color:#ffbeb8; }.customer-state button,.detail-state button { margin-left:8px; padding:3px 7px; background:transparent; }
.customer-list { margin:0; padding:0 10px 16px; list-style:none; }.customer-row { display:grid; width:100%; gap:5px; padding:13px 12px; border:0; border-radius:9px; background:transparent; color:inherit; text-align:left; cursor:pointer; }.customer-row:hover,.customer-row.selected { background:#1e334d; }.customer-row.selected { box-shadow:inset 3px 0 #7de2c3; }.customer-row strong { font-size:14px; }.customer-row span,.customer-row small { color:#90a4c1; font-size:12px; }.customer-row .intent-chip { color:#8ee6cc; }.customer-row small { color:#7186a5; }
.customer-detail-pane { min-width:0; padding:32px clamp(22px, 4vw, 52px) 48px; overflow:auto; }.detail-header { padding-bottom:20px; border-bottom:1px solid #2d405c; }.back-button { display:none; margin-bottom:16px; padding:4px 0; border:0; background:transparent; color:#8ee6cc; }.customer-editor { display:grid; gap:13px; max-width:720px; padding:22px 0; }.customer-editor label { display:grid; gap:6px; color:#b8c8dd; font-size:13px; }.customer-editor label span { color:#7186a5; font-weight:400; }.customer-editor textarea { resize:vertical; }.form-error { margin:0; font-size:13px; }.save-button { justify-self:start; }
.insight-section { max-width:760px; padding:24px 0; border-top:1px solid #2d405c; }.insight-section h3 { margin:0 0 12px; font-size:16px; }.insight-section h3 small { color:#7890ad; font-weight:400; }.empty-insight { margin:0; color:#8498b4; font-size:13px; }.insight-list,.evidence-list { display:grid; gap:8px; margin:0; padding:0; list-style:none; }.insight-list li { display:grid; grid-template-columns:minmax(100px, 160px) minmax(0, 1fr) auto; gap:10px; padding:10px 12px; border-radius:7px; background:#101b2c; font-size:13px; }.insight-list span { color:#c5d2e3; overflow-wrap:anywhere; }.insight-list small { color:#8296b0; white-space:nowrap; }.evidence-list { counter-reset:evidence; }.evidence-list li { display:grid; gap:5px; padding:12px; border-left:2px solid #426281; background:#101b2c; }.evidence-list a { color:#8ee6cc; font-size:13px; }.evidence-list time { color:#8296b0; font-size:12px; }.evidence-list p { margin:2px 0 0; color:#c0cde0; white-space:pre-wrap; overflow-wrap:anywhere; font-size:13px; line-height:1.5; }
@media (max-width:760px) { .customer-module { display:block; border-radius:12px; }.customer-list-pane { border-right:0; }.customer-detail-pane { display:none; }.showing-detail .customer-list-pane { display:none; }.showing-detail .customer-detail-pane { display:block; min-height:100%; padding:22px 18px 36px; }.back-button { display:inline-block; }.module-heading { padding:22px 18px 16px; }.insight-list li { grid-template-columns:1fr; gap:4px; }.insight-list small { white-space:normal; } }
</style>
