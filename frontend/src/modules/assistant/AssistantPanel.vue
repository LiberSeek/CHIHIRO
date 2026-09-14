<script setup lang="ts">
import { useAssistantStore, type AssistantMode } from './session'
import { Check, X, Send, RefreshCw } from '@lucide/vue'

const assistant = useAssistantStore()
const modes: { value: AssistantMode; label: string }[] = [
  { value: 'ask', label: '逐条审核' }, { value: 'auto', label: '自动（敏感内容审核）' }, { value: 'always', label: '全部自动' },
]
const statusLabels: Record<string, string> = { pending: '待审核', sending: '发送中', sent: '已发送', discarded: '已丢弃', failed: '发送失败', unknown: '发送结果未知', expired: '已失效', superseded: '已失效' }
function changeMode(event: Event) {
  void assistant.setMode((event.target as HTMLSelectElement).value as AssistantMode)
}
</script>

<template>
  <section class="assistant-panel" aria-label="会话助手">
    <header>
      <div><strong>会话助手</strong><span>{{ assistant.context?.title }}</span></div>
      <button type="button" title="收起助手" aria-label="收起助手" @click="assistant.open = false"><X :size="16" /></button>
    </header>
    <div class="assistant-controls">
      <label class="assistant-hosting"><input type="checkbox" :checked="assistant.enabled" :disabled="assistant.busy || !assistant.connected" @change="assistant.setHosting(!assistant.enabled, assistant.session?.mode ?? 'ask')">会话托管</label>
      <select aria-label="托管回复模式" :value="assistant.session?.mode ?? 'ask'" :disabled="assistant.busy || !assistant.connected" @change="changeMode">
        <option v-for="mode in modes" :key="mode.value" :value="mode.value">{{ mode.label }}</option>
      </select>
      <span class="assistant-state">{{ assistant.session?.assistHold ? '辅助审核中' : assistant.enabled ? '托管中' : '人工回复' }}</span>
    </div>
    <div v-if="assistant.error" class="assistant-error" role="alert">{{ assistant.error }}<button type="button" aria-label="重新连接助手" title="重新连接助手" :disabled="assistant.busy" @click="assistant.context && assistant.start(assistant.context.accountId)"><RefreshCw :size="14" /></button></div>
    <div v-else-if="!assistant.connected" role="status">正在连接助手…</div>
    <div class="assistant-activity" aria-live="polite">
      <p v-if="assistant.thinkingText" class="assistant-steps">{{ assistant.thinkingText }}</p>
      <article v-for="draft in assistant.currentDrafts" :key="draft.id" class="assistant-draft">
        <p>{{ draft.text }}</p>
        <footer><span>{{ assistant.uncertainDrafts.includes(draft.id) ? '发送结果待核实' : statusLabels[draft.status] ?? draft.status }}</span>
          <template v-if="draft.status === 'pending' && !assistant.uncertainDrafts.includes(draft.id)">
            <button type="button" :disabled="assistant.busy || !assistant.connected" @click="assistant.resolveDraft(draft.id, 'approve')"><Check :size="14" />确认发送</button>
            <button type="button" title="丢弃草稿" aria-label="丢弃草稿" :disabled="assistant.busy || !assistant.connected" @click="assistant.resolveDraft(draft.id, 'discard')"><X :size="14" /></button>
          </template>
          <template v-else-if="draft.status === 'unknown'">
            <button type="button" :disabled="!assistant.connected || Boolean(assistant.deliveryActions[draft.id])" @click="assistant.resolveDelivery(draft.id, 'reconcile-sent')"><Check :size="14" />确认已发送</button>
            <button type="button" :disabled="!assistant.connected || Boolean(assistant.deliveryActions[draft.id])" @click="assistant.resolveDelivery(draft.id, 'retry')"><RefreshCw :size="14" />重新发送</button>
          </template>
          <template v-else-if="draft.status === 'failed'">
            <button type="button" :disabled="!assistant.connected || Boolean(assistant.deliveryActions[draft.id])" @click="assistant.resolveDelivery(draft.id, 'retry')"><RefreshCw :size="14" />重新发送</button>
          </template>
        </footer>
      </article>
    </div>
    <blockquote v-if="assistant.quote">{{ assistant.quote }}<button type="button" title="移除引用" aria-label="移除引用" :disabled="assistant.busy" @click="assistant.quote = ''"><X :size="14" /></button></blockquote>
    <form @submit.prevent="assistant.ask">
      <textarea v-model="assistant.instruction" aria-label="询问助手" placeholder="询问助手" rows="2" :disabled="assistant.busy" />
      <button type="submit" title="询问助手" aria-label="询问助手" :disabled="assistant.busy || !assistant.connected || (!assistant.instruction.trim() && !assistant.quote)"><Send :size="16" /></button>
    </form>
  </section>
</template>

<style scoped>
.assistant-panel { box-sizing:border-box; width:100%; min-width:0; max-height:340px; overflow:auto; background:#f5f8f8; color:#253337; border-top:1px solid #cbd9d9; padding:12px; font-size:13px; line-height:1.5; }
header, header>div, .assistant-controls, footer, form, .assistant-error { display:flex; align-items:center; gap:8px; }
header { justify-content:space-between; margin-bottom:8px; }
header>div { min-width:0; flex-wrap:wrap; }
header span { color:#66777b; overflow-wrap:anywhere; }
button { display:inline-flex; align-items:center; justify-content:center; gap:4px; flex-shrink:0; min-width:28px; min-height:28px; padding:4px 6px; background:transparent; border:1px solid #b6caca; border-radius:4px; color:inherit; cursor:pointer; }
button:hover { background:#e1eded; }
button:disabled { opacity:.5; cursor:default; }
.assistant-controls { flex-wrap:wrap; }
.assistant-hosting { display:inline-flex; align-items:center; gap:5px; white-space:nowrap; }
input[type=checkbox] { appearance:auto; width:15px; height:15px; margin:0; accent-color:#16796d; }
select { max-width:100%; padding:3px; border:1px solid #b6caca; border-radius:4px; background:white; color:inherit; }
.assistant-state { font-size:12px; color:#58736e; }
.assistant-error { margin:8px 0; color:#a32b36; overflow-wrap:anywhere; }
.assistant-steps, .assistant-draft p, blockquote { white-space:pre-wrap; overflow-wrap:anywhere; }
.assistant-steps { margin:10px 0; color:#526c6b; }
.assistant-draft { padding:8px 0; border-bottom:1px solid #d9e2e2; }
.assistant-draft p { margin:0 0 6px; }
footer { justify-content:flex-end; }
footer>span { margin-right:auto; color:#58736e; }
blockquote { margin:8px 0; border-left:3px solid #93b8b2; padding-left:8px; max-height:90px; overflow:auto; }
blockquote button { float:right; }
form { align-items:flex-end; margin-top:10px; }
textarea { width:100%; min-width:0; resize:vertical; max-height:100px; background:white; color:inherit; border:1px solid #b6caca; border-radius:4px; padding:6px 8px; font:inherit; }
</style>
