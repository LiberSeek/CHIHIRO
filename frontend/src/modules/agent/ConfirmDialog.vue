<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="chihiro-confirm"
      :class="`v-theme--${customizer.uiTheme}`"
      role="presentation"
    >
      <div class="chihiro-confirm-scrim" @click="handleCancel" />
      <div
        ref="cardRef"
        class="chihiro-confirm-card"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="messageId"
        tabindex="-1"
        @keydown.esc.prevent="handleCancel"
      >
        <h2 :id="titleId" class="chihiro-confirm-title">{{ title }}</h2>
        <p :id="messageId" class="chihiro-confirm-message">{{ message }}</p>
        <div class="chihiro-confirm-actions">
          <button
            ref="cancelRef"
            class="chihiro-confirm-btn"
            type="button"
            @click="handleCancel"
          >
            {{ cancelText }}
          </button>
          <button
            class="chihiro-confirm-btn is-confirm"
            type="button"
            @click="handleConfirm"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId } from 'vue'
import { useCustomizerStore } from './native/src/stores/customizer'
import { useI18n } from './native/src/i18n/composables'
import type { ConfirmDialogOptions } from './native/src/utils/confirmDialog'

const customizer = useCustomizerStore()
const { t } = useI18n()
const isOpen = ref(false)
const title = ref('')
const message = ref('')
const confirmText = ref('')
const cancelText = ref('')
const cardRef = ref<HTMLElement | null>(null)
const cancelRef = ref<HTMLButtonElement | null>(null)
const titleId = useId()
const messageId = useId()
let resolvePromise: ((value: boolean) => void) | null = null

function settle(value: boolean) {
  isOpen.value = false
  const resolve = resolvePromise
  resolvePromise = null
  resolve?.(value)
}

function handleConfirm() {
  settle(true)
}

function handleCancel() {
  settle(false)
}

function onKeydown(event: KeyboardEvent) {
  if (!isOpen.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    handleCancel()
  }
}

function open(options: ConfirmDialogOptions = {}) {
  if (resolvePromise) resolvePromise(false)
  title.value = options.title || t('core.common.dialog.confirmTitle')
  message.value = options.message || t('core.common.dialog.confirmMessage')
  confirmText.value = options.confirmText || t('core.common.dialog.confirmButton')
  cancelText.value = options.cancelText || t('core.common.dialog.cancelButton')
  isOpen.value = true
  void nextTick(() => {
    cancelRef.value?.focus()
  })
  return new Promise<boolean>((resolve) => {
    resolvePromise = resolve
  })
}

window.addEventListener('keydown', onKeydown)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (resolvePromise) resolvePromise(false)
})

defineExpose({ open })
</script>

<style scoped>
.chihiro-confirm {
  position: fixed;
  inset: 0;
  z-index: 5200;
  display: grid;
  place-items: center;
  padding: 24px;
  font-family: Roboto, Helvetica, Arial, sans-serif;
  pointer-events: auto;
  -webkit-user-select: text;
  user-select: text;
}

.chihiro-confirm-scrim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.52);
}

.chihiro-confirm-card {
  position: relative;
  width: min(512px, calc(100vw - 48px));
  padding: 28px 28px 20px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.38);
  outline: none;
}

.chihiro-confirm-title {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 500;
  line-height: 1.3;
  letter-spacing: 0.01em;
}

.chihiro-confirm-message {
  margin: 0 0 28px;
  font-size: 14px;
  line-height: 1.6;
  color: rgba(var(--v-theme-on-surface), 0.72);
  white-space: pre-wrap;
}

.chihiro-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.chihiro-confirm-btn {
  min-height: 40px;
  padding: 0 20px;
  border: 0;
  border-radius: 20px;
  background: rgba(var(--v-theme-on-surface), 0.08);
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  outline: none;
}

.chihiro-confirm-btn:hover,
.chihiro-confirm-btn:focus-visible {
  background: rgba(var(--v-theme-on-surface), 0.14);
}

.chihiro-confirm-btn.is-confirm {
  background: rgba(var(--v-theme-on-surface), 0.12);
}

.chihiro-confirm-btn.is-confirm:hover,
.chihiro-confirm-btn.is-confirm:focus-visible {
  background: rgba(var(--v-theme-on-surface), 0.18);
}
</style>
