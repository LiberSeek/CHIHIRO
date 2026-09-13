<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useShellStore } from '@/stores/shell'
import { createImClient, type ImConversation, type ImMessage } from './im-client'
const shell = useShellStore(); const client = createImClient(); const conversations = ref<ImConversation[]>([]); const messages = ref<ImMessage[]>([]); const active = ref<ImConversation | null>(null); const error = ref(''); const draft = ref(''); const sending = ref(false)
async function load() { if (!shell.activeAccountId) return; try { conversations.value = await client.conversations(shell.activeAccountId) } catch (e) { error.value = e instanceof Error ? e.message : '无法加载会话' } }
async function select(item: ImConversation) { if (!shell.activeAccountId) return; active.value = item; messages.value = await client.messages(shell.activeAccountId, item.id) }
async function send() { if (!shell.activeAccountId || !active.value || !draft.value.trim() || sending.value) return; const text = draft.value.trim(); draft.value = ''; sending.value = true; error.value = ''; try { await client.send(shell.activeAccountId, active.value.id, text); messages.value.push({ id: `local-${Date.now()}`, text, sender: 'me', outgoing: true }) } catch (e) { error.value = e instanceof Error ? e.message : '发送失败'; draft.value = text } finally { sending.value = false } }
onMounted(load)
</script>
<template>
  <section class="im-module" aria-label="消息与联系人">
    <aside class="conversation-list"><header><span class="eyebrow">MESSAGES</span><h1>消息</h1></header><p v-if="error" class="error">{{ error }}</p><button v-for="item in conversations" :key="item.id" class="conversation" :class="{ active: active?.id === item.id }" @click="select(item)"><strong>{{ item.title }}</strong><small v-if="item.unread">{{ item.unread }}</small></button><p v-if="!conversations.length && !error" class="empty">暂无会话</p></aside>
    <main class="message-pane"><h2>{{ active?.title ?? '选择一个会话' }}</h2><div class="messages"><article v-for="message in messages" :key="message.id" :class="['message', { outgoing: message.outgoing }]">{{ message.text }}</article></div><form v-if="active" class="composer" @submit.prevent="send"><textarea v-model="draft" rows="2" :disabled="sending" placeholder="输入消息…" aria-label="消息" /><button type="submit" :disabled="sending || !draft.trim()">{{ sending ? '发送中…' : '发送' }}</button></form><div v-else class="composer-hint">选择会话开始聊天</div></main>
  </section>
</template>
<style scoped>
.im-module{display:flex;height:100%;min-height:560px;border:1px solid #dfe5ee;border-radius:14px;overflow:hidden;background:#fff}.conversation-list{width:280px;border-right:1px solid #e3e8ef;padding:22px 12px}.conversation-list header{padding:0 10px 18px}.conversation-list h1{margin:5px 0;font-size:24px}.conversation{display:flex;width:100%;justify-content:space-between;padding:12px 10px;border:0;border-radius:8px;background:transparent;text-align:left;cursor:pointer}.conversation.active,.conversation:hover{background:#edf5f3}.conversation small{color:#167866}.empty,.error{padding:10px;color:#8391a5;font-size:12px}.error{color:#b34b4b}.message-pane{display:flex;min-width:0;flex:1;flex-direction:column;padding:24px}.message-pane h2{margin:0 0 18px;font-size:17px}.messages{flex:1;overflow:auto}.message{max-width:70%;margin:8px 0;padding:9px 12px;border-radius:10px;background:#f0f3f7}.message.outgoing{margin-left:auto;background:#d9f2ea}.composer-hint{padding-top:14px;color:#8b99aa;font-size:11px}
.composer{display:flex;gap:8px;margin-top:14px}.composer textarea{flex:1;resize:none;padding:10px;border:1px solid #d5dde8;border-radius:8px;font:inherit}.composer button{padding:0 18px;border:0;border-radius:8px;background:#1c7966;color:#fff;font-weight:700}.composer button:disabled{opacity:.5}
</style>
