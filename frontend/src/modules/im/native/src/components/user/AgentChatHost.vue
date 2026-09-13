<template>
    <Teleport v-if="active && state !== 'ready'" :to="mainTarget">
        <div class="agent-chat-status" role="status">
            <span v-if="state === 'starting'">正在启动 Agent…</span>
            <span v-else-if="state === 'loading'">正在加载 Agent 工作区…</span>
            <template v-else>
                <span>Agent 工作区加载失败</span>
                <small>{{ errorMessage }}</small>
                <button type="button" @click="retry">重试</button>
            </template>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch, nextTick } from 'vue'
const props = withDefaults(defineProps<{
    active: boolean
    sidebarTarget?: string
    mainTarget?: string
}>(), {
    sidebarTarget: '#chihiro-agent-sidebar-slot',
    mainTarget: '#chihiro-agent-main-slot',
})
let controller: { dispose(): void; setActive(active: boolean): void } | null = null
let pending = false
let destroyed = false
const abort = new AbortController()
const state = ref<'starting' | 'loading' | 'ready' | 'error'>('starting')
const errorMessage = ref('')

function loadAsset(kind: 'script' | 'style') {
    if (kind === 'script' && window.ChihiroChatUI) return Promise.resolve()
    const selector = `[data-chihiro-chatui-asset="${kind}"]`
    if (kind === 'style' && document.querySelector<HTMLElement>(selector)?.dataset.loaded) return Promise.resolve()
    document.querySelector(selector)?.remove()
    return new Promise<void>((resolve, reject) => {
        const element = kind === 'script' ? document.createElement('script') : document.createElement('link')
        element.dataset.chihiroChatuiAsset = kind
        const timer = setTimeout(() => finish(new Error('ChatUI 资源加载超时')), 45000)
        function finish(error?: Error) {
            clearTimeout(timer)
            element.onload = element.onerror = null
            if (error) { element.remove(); reject(error) }
            else { element.dataset.loaded = 'true'; resolve() }
        }
        if (element instanceof HTMLScriptElement) {
            element.src = '/astrbot/chihiro/chihiro-chatui.js'
        } else {
            element.rel = 'stylesheet'
            element.href = '/astrbot/chihiro/chihiro-chatui.css'
        }
        element.onload = () => finish()
        element.onerror = () => finish(new Error('ChatUI 资源缺失，请检查 AstrBot UI 构建和网关'))
        document.head.appendChild(element)
    })
}
async function retry() {
    if (pending || destroyed || controller) return
    pending = true
    errorMessage.value = ''
    try {
        state.value = 'starting'
        const response = await fetch('/api/runtime/bot/ensure', { method: 'POST', signal: abort.signal })
        const snapshot = await response.json()
        if (!response.ok || !snapshot?.astrbot?.running) throw new Error(snapshot.message || snapshot.error || 'AstrBot 未能启动')
        if (destroyed) return
        state.value = 'loading'
        await Promise.all([loadAsset('script'), loadAsset('style')])
        await nextTick()
        if (destroyed) return
        if (!document.querySelector(props.mainTarget) || !document.querySelector(props.sidebarTarget)) throw new Error('Agent 显示容器不存在')
        if (!window.ChihiroChatUI) throw new Error('ChatUI mount API unavailable')
        const mounted = await window.ChihiroChatUI.mount({ sidebarTarget: props.sidebarTarget, mainTarget: props.mainTarget })
        if (destroyed) { mounted.dispose(); return }
        controller = mounted
        controller.setActive(props.active)
        state.value = 'ready'
    } catch (error) {
        if (!destroyed) {
            state.value = 'error'
            errorMessage.value = error instanceof Error ? error.message : String(error)
            console.error('[Chihiro] ChatUI mount failed', error)
        }
    } finally { pending = false }
}
watch(() => props.active, (active) => {
    controller?.setActive(active)
    if (active && !controller && state.value !== 'error') void retry()
}, { immediate: true })
onBeforeUnmount(() => { destroyed = true; abort.abort(); controller?.dispose(); controller = null })
</script>

<style scoped>
.agent-chat-status {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    text-align: center;
    gap: 12px;
    padding: 24px;
    color: var(--color-font);
    background: var(--color-bg);
    font-size: 14px;
}
.agent-chat-status small { max-width: 420px; overflow-wrap: anywhere; opacity: .7; }
.agent-chat-status button {
    justify-self: center;
    border: 1px solid currentColor;
    border-radius: 6px;
    padding: 6px 14px;
    color: inherit;
    background: transparent;
    cursor: pointer;
}
</style>
