<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { ExternalLink, RefreshCw, X } from '@lucide/vue'

const props = defineProps<{
  open: boolean
  title: string
  src: string
}>()

const emit = defineEmits<{ close: [] }>()
const frameKey = ref(0)
const loading = ref(true)
const failed = ref(false)
const closeButton = ref<HTMLButtonElement | null>(null)

watch(() => props.open, async (open) => {
  if (!open) return
  loading.value = true
  failed.value = false
  await nextTick()
  closeButton.value?.focus()
})

function reload() {
  loading.value = true
  failed.value = false
  frameKey.value += 1
}

function openExternal() {
  window.open(props.src, '_blank', 'noopener,noreferrer')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="external-settings">
      <div v-if="open" class="external-settings-backdrop" role="presentation" @click.self="emit('close')" @keydown="onKeydown">
        <section class="external-settings-window" role="dialog" aria-modal="true" :aria-label="title">
          <header class="external-settings-toolbar">
            <h2>{{ title }}</h2>
            <div class="external-settings-actions">
              <button type="button" title="重新加载" aria-label="重新加载" @click="reload">
                <RefreshCw :size="17" />
              </button>
              <button type="button" title="在新窗口打开" aria-label="在新窗口打开" @click="openExternal">
                <ExternalLink :size="17" />
              </button>
              <button ref="closeButton" type="button" title="关闭" aria-label="关闭" @click="emit('close')">
                <X :size="18" />
              </button>
            </div>
          </header>
          <div class="external-settings-content">
            <div v-if="loading" class="external-settings-loading" aria-live="polite">
              <span aria-hidden="true" />
              <p>正在加载 {{ title }}</p>
            </div>
            <div v-if="failed" class="external-settings-failed" role="alert">
              <p>{{ title }} 加载失败</p>
              <button type="button" @click="reload">重新加载</button>
            </div>
            <iframe
              :key="frameKey"
              :src="src"
              :title="title"
              allow="clipboard-read; clipboard-write"
              @load="loading = false"
              @error="failed = true; loading = false"
            />
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.external-settings-backdrop {
  position: fixed;
  z-index: 4000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px 32px;
  background: rgb(0 0 0 / 48%);
  backdrop-filter: blur(7px);
}
.external-settings-window {
  display: grid;
  width: min(1440px, calc(100vw - 64px));
  height: min(1000px, calc(100vh - 48px));
  min-width: 0;
  min-height: 0;
  grid-template-rows: 48px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--shell-line);
  border-radius: 10px;
  color: var(--shell-text);
  background: var(--shell-bg);
  box-shadow: 0 28px 80px rgb(0 0 0 / 48%);
}
.external-settings-toolbar {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 10px 0 18px;
  border-bottom: 1px solid var(--shell-line);
  background: var(--shell-rail);
}
.external-settings-toolbar h2 {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.external-settings-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
}
.external-settings-actions button {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 7px;
  color: var(--shell-muted);
  background: transparent;
  cursor: pointer;
}
.external-settings-actions button:hover,
.external-settings-actions button:focus-visible {
  color: var(--shell-text);
  background: var(--shell-line);
  outline: none;
}
.external-settings-content {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--shell-bg);
}
.external-settings-content iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: var(--shell-bg);
}
.external-settings-loading,
.external-settings-failed {
  position: absolute;
  z-index: 1;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 12px;
  color: var(--shell-muted);
  background: var(--shell-bg);
  font-size: 13px;
}
.external-settings-loading span {
  width: 24px;
  height: 24px;
  border: 2px solid var(--shell-line);
  border-top-color: var(--shell-accent);
  border-radius: 50%;
  animation: external-settings-spin .8s linear infinite;
}
.external-settings-loading p,
.external-settings-failed p { margin: 0; }
.external-settings-failed button {
  padding: 7px 13px;
  border: 1px solid var(--shell-line);
  border-radius: 7px;
  color: var(--shell-text);
  background: var(--shell-rail);
  cursor: pointer;
}
.external-settings-enter-active,
.external-settings-leave-active { transition: opacity .16s ease; }
.external-settings-enter-active .external-settings-window,
.external-settings-leave-active .external-settings-window { transition: transform .16s ease, opacity .16s ease; }
.external-settings-enter-from,
.external-settings-leave-to { opacity: 0; }
.external-settings-enter-from .external-settings-window,
.external-settings-leave-to .external-settings-window { opacity: 0; transform: translateY(5px) scale(.992); }
@keyframes external-settings-spin { to { transform: rotate(1turn); } }
@media (max-width: 700px) {
  .external-settings-backdrop { padding: 0; }
  .external-settings-window {
    width: 100vw;
    height: 100vh;
    border: 0;
    border-radius: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .external-settings-enter-active,
  .external-settings-leave-active,
  .external-settings-enter-active .external-settings-window,
  .external-settings-leave-active .external-settings-window { transition: none; }
}
</style>
