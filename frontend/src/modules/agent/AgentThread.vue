<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useAgentWorkspace } from './useAgentWorkspace'
const workspace = useAgentWorkspace(); const list = ref<HTMLElement | null>(null)
async function submit() { await workspace.send() }
function onKeydown(event: KeyboardEvent) { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void submit() } }
watch(() => workspace.messages.value.map((message) => message.content).join('').length, async () => { await nextTick(); if (list.value) list.value.scrollTop = list.value.scrollHeight })
</script>
<template>
  <div class="agent-thread">
    <div ref="list" class="message-list" aria-live="polite">
      <div v-if="workspace.loading.value" class="thread-state">正在加载会话…</div>
      <div v-else-if="!workspace.activeSessionId.value" class="thread-state welcome"><span>✦</span><h2>开始一个 Agent 会话</h2><p>创建会话后，可以流式对话并在左侧管理项目和历史。</p><button type="button" @click="workspace.newSession()">创建会话</button></div>
      <div v-else-if="!workspace.messages.value.length" class="thread-state welcome"><span>✦</span><h2>今天想完成什么？</h2><p>描述目标、贴入资料，或让 Agent 帮你拆解下一步。</p></div>
      <article v-for="message in workspace.messages.value" :key="message.id" class="message" :class="message.role"><div class="avatar">{{ message.role === 'user' ? '你' : '✦' }}</div><div class="message-body"><header>{{ message.role === 'user' ? '你' : 'AstrBot' }}<span v-if="message.streaming" class="streaming">生成中</span></header><div class="message-content">{{ message.content }}<span v-if="message.streaming" class="cursor">▋</span></div><p v-if="message.error" class="message-error">{{ message.error }}</p></div></article>
    </div>
    <form class="composer" @submit.prevent="submit">
      <div v-if="workspace.error.value" class="composer-error">{{ workspace.error.value }}</div>
      <textarea v-model="workspace.draft.value" :disabled="!workspace.activeSessionId.value || workspace.sending.value" rows="3" placeholder="给 Agent 发送消息…" aria-label="Agent 消息" @keydown="onKeydown" />
      <div class="composer-bar"><span>Enter 发送 · Shift+Enter 换行</span><button v-if="workspace.sending.value" class="stop" type="button" @click="workspace.stop()">■ 停止</button><button v-else type="submit" :disabled="!workspace.draft.value.trim() || !workspace.activeSessionId.value">发送 ↑</button></div>
    </form>
  </div>
</template>
<style scoped>
.agent-thread { display: flex; min-height: 0; flex: 1; flex-direction: column; background: #101a2a; }.message-list { min-height: 0; flex: 1; overflow-y: auto; padding: 30px clamp(18px, 6vw, 80px) 20px; }.message { display: flex; max-width: 820px; gap: 12px; margin: 0 auto 26px; }.avatar { display: grid; width: 30px; height: 30px; flex: 0 0 30px; place-items: center; border-radius: 8px; background: #25374f; color: #aebfd5; font-size: 11px; font-weight: 700; }.message.assistant .avatar { background: #245348; color: #a8f0d9; }.message-body { min-width: 0; flex: 1; }.message-body header { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; color: #dce7f5; font-size: 12px; font-weight: 700; }.streaming { padding: 2px 6px; border-radius: 999px; background: #1f4a42; color: #8ee2c8; font-size: 9px; }.message-content { color: #bfcee0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 14px; line-height: 1.7; }.message.user .message-content { color: #e5edf8; }.cursor { color: #72ddbd; animation: blink 1s step-end infinite; }.message-error, .composer-error { color: #f1aaaa; font-size: 11px; }.thread-state { display: grid; height: 100%; place-content: center; color: #8092aa; text-align: center; }.welcome span { color: #79dfc1; font-size: 34px; }.welcome h2 { margin: 12px 0 3px; color: #e3ecf8; font-size: 22px; }.welcome p { max-width: 440px; margin: 4px auto 18px; line-height: 1.6; }.welcome button { width: max-content; margin: auto; padding: 9px 14px; border: 1px solid #37615c; border-radius: 8px; background: #1c413c; color: #c7f7e8; cursor: pointer; }.composer { width: min(820px, calc(100% - 36px)); margin: 0 auto 22px; padding: 10px 12px 9px; border: 1px solid #33465f; border-radius: 13px; background: #17253a; box-shadow: 0 16px 40px #050b1480; }.composer textarea { width: 100%; resize: none; border: 0; outline: 0; background: transparent; color: #edf3fb; font: inherit; font-size: 14px; line-height: 1.5; }.composer textarea::placeholder { color: #73869f; }.composer-bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; }.composer-bar span { color: #71859f; font-size: 10px; }.composer button { padding: 7px 12px; border: 0; border-radius: 7px; background: #71dab9; color: #0b1b1a; font-weight: 700; cursor: pointer; }.composer button:disabled { cursor: default; opacity: .4; }.composer button.stop { background: #6d3850; color: #ffd7e4; }@keyframes blink { 50% { opacity: 0; } }
@media (max-width: 720px) { .message-list { padding-inline: 16px; }.composer { width: calc(100% - 20px); margin-bottom: 10px; }.composer-bar span { display: none; } }
</style>
