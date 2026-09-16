<script setup lang="ts">
import { computed } from 'vue'
import { useSuggestStore, type SuggestReply } from './suggest'

const props = defineProps<{ surface?: 'bubble' | 'composer' }>()

const suggest = useSuggestStore()
const surface = computed(() => props.surface || 'composer')
const items = computed<SuggestReply[]>(() => {
  if (surface.value === 'composer') return suggest.composerReply ? [suggest.composerReply] : []
  return suggest.replies
})
const visible = computed(() => suggest.generating || items.value.length > 0)
const countdownSec = computed(() => Math.max(0, Math.ceil(suggest.countdownMs / 1000)))
const skeletonCount = computed(() => surface.value === 'composer' ? 1 : 3)

function onSend(reply: SuggestReply, event: Event) {
  event.stopPropagation()
  suggest.sendReply(reply)
}
</script>

<template>
  <div v-if="visible" class="chihiro-suggest-bar" :data-surface="surface" aria-live="polite">
    <div v-if="suggest.generating" class="chihiro-suggest-skeleton" aria-hidden="true">
      <span v-for="index in skeletonCount" :key="index" />
    </div>
    <div v-else class="chihiro-suggest-chips">
      <div
        v-for="reply in items"
        :key="reply.id"
        class="chihiro-suggest-chip"
        :class="{ best: suggest.mode === 'auto' && reply.id === suggest.highlightedId }"
        role="button"
        tabindex="0"
        @click="suggest.pick(reply)"
        @keydown.enter.prevent="suggest.pick(reply)">
        <em class="chihiro-suggest-mark" aria-hidden="true">✦</em>
        <span>{{ reply.text }}</span>
        <small v-if="suggest.countingDown && reply.id === suggest.countdownReplyId">{{ countdownSec }}s</small>
        <button
          type="button"
          class="chihiro-suggest-send"
          title="发送"
          @click="onSend(reply, $event)">
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path fill="currentColor" d="M8 12.8a.75.75 0 0 1-.75-.75V5.86L5.03 8.08a.75.75 0 1 1-1.06-1.06l3.5-3.5a.75.75 0 0 1 1.06 0l3.5 3.5a.75.75 0 1 1-1.06 1.06L8.75 5.86v6.19A.75.75 0 0 1 8 12.8z"/>
          </svg>
        </button>
      </div>
      <button
        v-if="suggest.countingDown && surface === 'composer'"
        type="button"
        class="chihiro-suggest-cancel"
        @click="suggest.cancelCountdown()">
        取消
      </button>
    </div>
  </div>
</template>

<style scoped>
.chihiro-suggest-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
}
.chihiro-suggest-bar[data-surface="bubble"] {
  width: 100%;
  max-width: min(420px, 100%);
  min-width: min(240px, 100%);
}
.chihiro-suggest-skeleton {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}
.chihiro-suggest-skeleton span {
  display: block;
  height: 32px;
  width: 108px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-font-1) 16%, transparent);
  animation: chihiro-suggest-breathe 1.2s ease-in-out infinite;
}
.chihiro-suggest-bar[data-surface="composer"] .chihiro-suggest-skeleton span {
  width: min(280px, 100%);
  flex: 1 1 180px;
  max-width: 420px;
}
.chihiro-suggest-skeleton span:nth-child(2) { animation-delay: .15s; }
.chihiro-suggest-skeleton span:nth-child(3) { animation-delay: .3s; }
.chihiro-suggest-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  min-width: 0;
  width: 100%;
}
.chihiro-suggest-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: min(420px, 100%);
  min-height: 32px;
  padding: 4px 4px 4px 10px;
  border: 1px solid color-mix(in srgb, var(--color-font-1) 22%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-card-1) 88%, transparent);
  color: var(--color-font);
  font: inherit;
  font-size: 13px;
  line-height: 1.35;
  text-align: left;
  cursor: pointer;
}
.chihiro-suggest-bar[data-surface="composer"] .chihiro-suggest-chip {
  max-width: min(520px, 100%);
}
.chihiro-suggest-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.chihiro-suggest-mark {
  flex: 0 0 auto;
  font-style: normal;
  color: rgb(var(--v-theme-primary));
  font-size: 13px;
  line-height: 1;
}
.chihiro-suggest-chip.best {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 1px color-mix(in srgb, rgb(var(--v-theme-primary)) 45%, transparent);
}
.chihiro-suggest-chip small {
  color: rgb(var(--v-theme-primary));
  font-size: 11px;
  flex: 0 0 auto;
}
.chihiro-suggest-chip:hover {
  background: color-mix(in srgb, var(--color-card-2) 80%, transparent);
}
.chihiro-suggest-send {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--color-main);
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.chihiro-suggest-send:hover {
  filter: brightness(1.08);
}
.chihiro-suggest-send svg {
  display: block;
}
.chihiro-suggest-cancel {
  min-height: 28px;
  padding: 4px 10px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--color-font-1);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}
@keyframes chihiro-suggest-breathe {
  0%, 100% { opacity: .4; }
  50% { opacity: 1; }
}
</style>
