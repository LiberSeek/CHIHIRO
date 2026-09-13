<script setup lang="ts">
import { useAgentWorkspace } from './useAgentWorkspace'
const workspace = useAgentWorkspace()
async function send() {
  await workspace.send()
}
</script>
<template>
  <div class="agent-thread">
    <div class="thread-empty" v-if="!workspace.messages.value.length">开始一个 Agent 会话</div>
    <article v-for="(message, index) in workspace.messages.value" :key="index" :class="['message', message.role]">{{ message.content }}</article>
    <form class="composer" @submit.prevent="send"><textarea v-model="workspace.draft.value" rows="2" placeholder="向 Agent 提问…" /><button type="submit">发送</button></form>
  </div>
</template>
<style scoped>
.agent-thread { display:flex; flex:1; min-height:0; flex-direction:column; padding:24px; gap:12px; }.thread-empty { margin:auto; color:#8fa1bb; }.message { max-width:78%; padding:10px 13px; border-radius:10px; white-space:pre-wrap; }.message.user { align-self:flex-end; background:#235c63; }.message.assistant { align-self:flex-start; background:#1d2b42; }.composer { display:flex; gap:10px; margin-top:auto; }.composer textarea { flex:1; resize:none; padding:10px; border:1px solid #354a66; border-radius:8px; background:#121e31; color:inherit; }.composer button { padding:0 18px; border:0; border-radius:8px; background:#79dfc1; color:#10212a; font-weight:700; }
</style>
