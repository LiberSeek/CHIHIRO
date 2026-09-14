<!--
 * Chihiro fused composer: + / input / face / send in one bar
-->

<template>
    <section class="chihiro-composer">
        <div v-if="$slots.assistant" class="assistant-slot"><slot name="assistant" /></div>
        <div v-if="selecting" class="chihiro-select-bar">
            <div class="chihiro-select-actions">
                <button type="button" @click="emit('forward-individual')">
                    <font-awesome-icon :icon="['fas', 'share-from-square']" />
                    <span>{{ $t('逐条转发') }}</span>
                </button>
                <button type="button" @click="emit('forward-merged')">
                    <font-awesome-icon :icon="['fas', 'share']" />
                    <span>{{ $t('合并转发') }}</span>
                </button>
                <button type="button" @click="emit('copy')">
                    <font-awesome-icon :icon="['fas', 'copy']" />
                    <span>{{ $t('复制') }}</span>
                </button>
                <button type="button" class="is-danger" @click="emit('delete')">
                    <font-awesome-icon :icon="['fas', 'trash-can']" />
                    <span>{{ $t('删除') }}</span>
                </button>
            </div>
            <button type="button" class="chihiro-select-cancel" @click="emit('cancel-select')">
                {{ $t('取消') }}
            </button>
        </div>
        <div v-else
            class="chihiro-composer-row"
            :class="{ 'has-attach': imgCache.size > 0, 'is-reply': isReply }">
            <div class="chihiro-float-actions">
                <div class="new-msg chihiro-jump-bottom"
                    :class="{ 'is-on': showBottom }"
                    :title="$t('回到底部')"
                    @click="emit('jump-bottom')">
                    <div>
                        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                            <path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" d="M4.2 2.6 8 6.2 11.8 2.6"/>
                            <path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" d="M4.2 6.4 8 10 11.8 6.4"/>
                            <path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" d="M4.2 10.2 8 13.8 11.8 10.2"/>
                        </svg>
                        <span v-if="newMsgNum > 0">{{ newMsgNum }}</span>
                    </div>
                </div>
            </div>
            <div v-if="imgCache.size > 0" class="chihiro-attach">
                <div v-for="[key, value] in imgCache"
                    :key="'imgCache-' + key"
                    class="chihiro-attach-item">
                    <img :src="value" :alt="$t('图片')" @click="emit('attach-edit', key)">
                    <button type="button" class="chihiro-attach-x" :title="$t('删除')" @click.stop="emit('attach-delete', key)">
                        <font-awesome-icon :icon="['fas', 'xmark']" />
                    </button>
                </div>
            </div>
            <div v-if="isReply" class="chihiro-reply-preview">
                <div class="chihiro-reply-copy">
                    <div class="chihiro-reply-title">{{ $t('回复') }} {{ replyName }}</div>
                    <div class="chihiro-reply-text">{{ replyText }}</div>
                </div>
                <button type="button" class="chihiro-reply-close" :title="$t('取消')" @click.stop="emit('cancel-reply')">
                    <font-awesome-icon :icon="['fas', 'xmark']" />
                </button>
            </div>
            <div class="chihiro-composer-line">
                <div class="chihiro-plus-wrap">
                    <button type="button"
                        class="chihiro-plus"
                        :class="{ active: plusOpen }"
                        :title="$t('更多')"
                        @click.stop="emit('toggle-plus')">
                        <font-awesome-icon :icon="['fas', 'plus']" />
                    </button>
                    <div v-if="plusOpen" class="chihiro-plus-menu" @click.stop>
                        <button type="button" @click="emit('pick-image')">
                            <font-awesome-icon :icon="['fas', 'image']" />
                            <span>{{ $t('图片') }}</span>
                        </button>
                        <button type="button" @click="emit('pick-file')">
                            <font-awesome-icon :icon="['fas', 'folder']" />
                            <span>{{ $t('文件') }}</span>
                        </button>
                    </div>
                </div>
                <form class="chihiro-composer-form" @submit.prevent="emit('submit')">
                    <label for="main-input-ex" class="sr-only">{{ $t('消息输入框') }}</label>
                    <div id="main-input-ex"
                        ref="mainInput"
                        class="chihiro-composer-input"
                        :class="{ 'is-empty': isEmpty }"
                        role="textbox"
                        :contenteditable="disabled ? 'false' : 'true'"
                        :aria-placeholder="placeholder"
                        :aria-disabled="disabled"
                        @paste="onPaste"
                        @keydown="onKeydown"
                        @keyup="onKeyup"
                        @click="emit('input-click')"
                        @blur="saveSelection"
                        @input="onInput"
                        @compositionstart="onCompositionStart"
                        @compositionend="onCompositionEnd"
                        @compositioncancel="onCompositionCancel" />
                </form>
                <button type="button"
                    class="chihiro-input-face"
                    :class="{ active: faceOpen }"
                    :title="$t('表情')"
                    @click.stop="emit('toggle-face')">
                    <font-awesome-icon :icon="['fas', 'face-laugh']" />
                </button>
                <slot name="extra" />
                <button type="button" class="chihiro-send" :title="$t('发送')" @click="emit('send')">
                    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                        <path fill="currentColor" d="M8 12.8a.75.75 0 0 1-.75-.75V5.86L5.03 8.08a.75.75 0 1 1-1.06-1.06l3.5-3.5a.75.75 0 0 1 1.06 0l3.5 3.5a.75.75 0 1 1-1.06 1.06L8.75 5.86v6.19A.75.75 0 0 1 8 12.8z"/>
                    </svg>
                </button>
            </div>
        </div>
        <input id="choice-pic" type="file" accept="image/*" class="chihiro-file-input"
            @change="onPic">
        <label for="choice-pic" class="sr-only">{{ $t('选择图片') }}</label>
        <input id="choice-file" type="file" class="chihiro-file-input"
            @change="onFile">
        <label for="choice-file" class="sr-only">{{ $t('选择文件') }}</label>
    </section>
</template>

<script setup lang="ts">
    import { ref, useTemplateRef, watch } from 'vue'
    import { i18n } from '@chihiro/im-native/host'
    import Emoji from '@renderer/function/model/emoji'
    import type { MsgItemElem } from '@renderer/function/elements/information'

    defineOptions({ name: 'UserComposer' })

    const $t = i18n.global.t

    const props = defineProps<{
        modelValue: string
        selecting: boolean
        imgCache: Map<number, string>
        isReply: boolean
        replyName: string
        replyText: string
        showBottom: boolean
        newMsgNum: number
        plusOpen: boolean
        faceOpen: boolean
        disabled: boolean
        placeholder: string
    }>()

    const emit = defineEmits<{
        'update:modelValue': [value: string]
        submit: []
        send: []
        paste: [event: ClipboardEvent]
        keydown: [event: KeyboardEvent]
        keyup: [event: KeyboardEvent]
        'input-click': []
        input: [event: Event]
        compositionstart: [event: CompositionEvent]
        compositionend: [event: CompositionEvent]
        compositioncancel: [event: CompositionEvent]
        'toggle-plus': []
        'pick-image': []
        'pick-file': []
        'toggle-face': []
        'jump-bottom': []
        'attach-edit': [key: number]
        'attach-delete': [key: number]
        'cancel-reply': []
        'forward-individual': []
        'forward-merged': []
        copy: []
        delete: []
        'cancel-select': []
        'select-pic': [event: Event]
        'select-file': [event: Event]
    }>()

    const mainInput = useTemplateRef<HTMLDivElement>('mainInput')
    const isEmpty = ref(true)
    let syncingFromParent = false
    let savedRange: Range | null = null

    watch(() => props.modelValue, (value) => {
        if (syncingFromParent) return
        if (value === getPlainText()) return
        if (hasInlineFaces() && value !== '') return
        setPlainText(value)
    })

    function getPlainText() {
        const el = mainInput.value
        if (!el) return ''
        return (el.innerText || '').replace(/\u200B/g, '').replace(/\u00A0/g, ' ')
    }

    function hasInlineFaces() {
        return !!mainInput.value?.querySelector('.chihiro-inline-face')
    }

    function refreshEmpty() {
        isEmpty.value = !hasInlineFaces() && getPlainText() === ''
    }

    function setPlainText(text: string) {
        const el = mainInput.value
        if (!el) return
        el.textContent = text
        refreshEmpty()
    }

    function syncToModel(event?: Event) {
        refreshEmpty()
        syncingFromParent = true
        emit('update:modelValue', getPlainText())
        syncingFromParent = false
        if (event) emit('input', event)
    }

    function saveSelection() {
        const el = mainInput.value
        const sel = window.getSelection()
        if (!el || !sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return
        savedRange = sel.getRangeAt(0).cloneRange()
    }

    function placeCaretAfter(node: Node) {
        const el = mainInput.value
        if (!el) return
        const sel = window.getSelection()
        if (!sel) return
        const range = document.createRange()
        range.setStartAfter(node)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
        savedRange = range.cloneRange()
    }

    function insertNodeAtCaret(node: Node) {
        const el = mainInput.value
        if (!el) return
        el.focus()
        const sel = window.getSelection()
        let range: Range | null = null
        if (sel && sel.rangeCount > 0 && sel.anchorNode && el.contains(sel.anchorNode)) {
            range = sel.getRangeAt(0)
        } else if (savedRange && el.contains(savedRange.startContainer)) {
            range = savedRange
        }
        if (!range) {
            el.appendChild(node)
            placeCaretAfter(node)
            return
        }
        range.deleteContents()
        range.insertNode(node)
        placeCaretAfter(node)
    }

    function insertText(text: string) {
        if (!text) return
        const parts = text.split('\n')
        parts.forEach((part, index) => {
            if (part) insertNodeAtCaret(document.createTextNode(part))
            if (index < parts.length - 1) insertNodeAtCaret(document.createElement('br'))
        })
        // A trailing <br> alone does not create a caret position on the next line.
        if (text.endsWith('\n')) insertNodeAtCaret(document.createTextNode('\u200B'))
        syncToModel()
    }

    function insertFace(id: number) {
        const emoji = Emoji.get(id)
        if (!emoji || emoji.type === 'emoji') {
            insertText(emoji ? emoji.value : String.fromCodePoint(id))
            return
        }
        const img = document.createElement('img')
        img.className = 'chihiro-inline-face'
        img.dataset.faceId = String(id)
        img.src = emoji.value
        img.alt = emoji.description || $t('表情')
        img.title = img.alt
        img.draggable = false
        insertNodeAtCaret(img)
        insertNodeAtCaret(document.createTextNode('\u200B'))
        syncToModel()
    }

    function replaceFromLastAt(replacement: string) {
        const el = mainInput.value
        if (!el) {
            insertText(replacement)
            return
        }
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
        let lastAt: { node: Text, offset: number } | null = null
        while (walker.nextNode()) {
            const node = walker.currentNode as Text
            const index = node.data.lastIndexOf('@')
            if (index >= 0) lastAt = { node, offset: index }
        }
        if (!lastAt) {
            insertText(replacement)
            return
        }
        const range = document.createRange()
        range.setStart(lastAt.node, lastAt.offset)
        range.setEnd(el, el.childNodes.length)
        range.deleteContents()
        insertText(replacement)
    }

    function serialize(cache: MsgItemElem[]) {
        const el = mainInput.value
        if (!el) return ''
        let out = ''
        const walk = (nodes: NodeListOf<ChildNode> | ChildNode[]) => {
            for (const node of Array.from(nodes)) {
                if (node.nodeType === Node.TEXT_NODE) {
                    out += (node.textContent || '').replace(/\u200B/g, '')
                    continue
                }
                if (node.nodeType !== Node.ELEMENT_NODE) continue
                const child = node as HTMLElement
                if (child.classList.contains('chihiro-inline-face') && child.dataset.faceId) {
                    const id = Number(child.dataset.faceId)
                    if (!Number.isNaN(id)) {
                        const index = cache.length
                        cache.push({ type: 'face', id })
                        out += `[SQ:${index}]`
                    }
                    continue
                }
                if (child.tagName === 'BR') {
                    out += '\n'
                    continue
                }
                if ((child.tagName === 'DIV' || child.tagName === 'P') && out.length > 0 && !out.endsWith('\n')) {
                    out += '\n'
                }
                walk(child.childNodes)
            }
        }
        walk(el.childNodes)
        return out
    }

    function clear() {
        const el = mainInput.value
        if (el) el.innerHTML = ''
        syncToModel()
    }

    function onInput(event: Event) {
        const el = mainInput.value
        // Chrome leaves a caret-only <br> after deleting the final character.
        if (el && (event as InputEvent).inputType?.startsWith('delete') &&
            !el.textContent?.replace(/\u200B/g, '') && !hasInlineFaces()) {
            el.replaceChildren()
            savedRange = null
        }
        syncToModel(event)
    }
    function onPaste(event: ClipboardEvent) {
        emit('paste', event)
        if (event.defaultPrevented) return
        const text = event.clipboardData?.getData('text/plain') || ''
        event.preventDefault()
        if (text) insertText(text)
    }
    function onKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.isComposing) {
            event.preventDefault()
            if (event.shiftKey) insertText('\n')
        }
        emit('keydown', event)
    }
    function onKeyup(event: KeyboardEvent) { emit('keyup', event) }
    function onCompositionStart(event: CompositionEvent) { emit('compositionstart', event) }
    function onCompositionEnd(event: CompositionEvent) { emit('compositionend', event) }
    function onCompositionCancel(event: CompositionEvent) { emit('compositioncancel', event) }
    function onPic(event: Event) { emit('select-pic', event) }
    function onFile(event: Event) { emit('select-file', event) }

    defineExpose({
        getInput: () => mainInput.value,
        insertText,
        insertFace,
        replaceFromLastAt,
        serialize,
        clear,
        getPlainText,
        hasInlineFaces,
    })
</script>

<style>
.chihiro-composer {
    display: flex;
    flex-direction: column;
    width: 100%;
    margin: 0;
    padding: 0;
    background: transparent;
    overflow: visible;
    box-sizing: border-box;
}
.chihiro-composer .chihiro-select-bar {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    width: 100%;
    min-height: 36px;
    padding: 0 8px;
    box-sizing: border-box;
}
.chihiro-composer .chihiro-select-actions {
    display: flex;
    align-items: center;
    gap: 20px;
    flex: 1 1 auto;
    min-width: 0;
}
.chihiro-composer .chihiro-select-bar button {
    appearance: none;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 6px 14px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--color-font);
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
}
.chihiro-composer .chihiro-select-bar button:hover {
    background: rgba(127, 127, 127, 0.16);
}
.chihiro-composer .chihiro-select-bar button svg {
    width: 14px;
    height: 14px;
    margin: 0;
    color: inherit;
}
.chihiro-composer .chihiro-select-bar button.is-danger {
    color: #ff453a;
}
.chihiro-composer .chihiro-select-cancel {
    margin-left: auto;
    color: var(--color-font-1);
}
.chihiro-composer .chihiro-composer-row {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    position: relative;
    width: 100%;
    min-height: 48px;
    padding: 6px;
    box-sizing: border-box;
    background: var(--color-card-1);
    border: 1px solid rgba(127, 127, 127, 0.18);
    border-radius: 24px;
    overflow: visible;
}
.chihiro-composer .chihiro-composer-row.has-attach,
.chihiro-composer .chihiro-composer-row.is-reply {
    border-radius: 18px;
}
.chihiro-composer .chihiro-composer-row:focus-within {
    border-color: rgba(0, 122, 255, 0.45);
}
.chihiro-composer .chihiro-composer-line {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    gap: 6px;
    width: 100%;
    min-height: 36px;
    box-sizing: border-box;
}
.chihiro-composer .chihiro-composer-form {
    flex: 1 1 auto;
    min-width: 0;
    width: auto;
    align-self: stretch;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    background: transparent;
    border: 0;
    overflow: visible;
}
.chihiro-composer .chihiro-composer-form .chihiro-composer-input {
    display: block;
    width: 100%;
    min-width: 0;
    height: 36px;
    min-height: 36px;
    max-height: 120px;
    margin: 0;
    padding: 0 4px;
    background: transparent;
    border: 0;
    outline: none;
    box-shadow: none;
    border-radius: 0;
    color: var(--color-font);
    font-size: 14px;
    line-height: 36px;
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;
    caret-color: var(--color-font);
    white-space: pre-wrap;
    word-break: break-word;
}
.chihiro-composer .chihiro-composer-form .chihiro-composer-input.is-multiline {
    padding: 8px 4px;
    line-height: 20px;
}
.chihiro-composer .chihiro-composer-form .chihiro-composer-input.is-empty:after {
    content: attr(aria-placeholder);
    color: var(--color-font-2);
    opacity: 0.65;
    pointer-events: none;
}
.chihiro-composer .chihiro-composer-form .chihiro-composer-input[aria-disabled="true"] {
    color: var(--color-font-2);
    opacity: 0.7;
}
.chihiro-composer .chihiro-composer-form .chihiro-inline-face {
    display: inline-block;
    width: 20px;
    height: 20px;
    margin: 0 1px;
    vertical-align: text-bottom;
    object-fit: contain;
}
.chihiro-composer .chihiro-plus-wrap,
.chihiro-composer .chihiro-plus,
.chihiro-composer .chihiro-input-face,
.chihiro-composer .chihiro-send {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 50%;
    display: grid;
    place-items: center;
    cursor: pointer;
    background: transparent;
    color: var(--color-font-1);
    box-sizing: border-box;
}
.chihiro-composer .chihiro-plus-wrap {
    position: relative;
    flex: 0 0 36px;
    cursor: default;
    background: transparent;
}
.chihiro-composer .chihiro-input-face {
    position: static;
    flex: 0 0 36px;
    transform: none;
}
.chihiro-composer .chihiro-send {
    flex: 0 0 36px;
    background: rgba(255, 255, 255, 0.16);
    color: #fff;
}
html.bp-light .chihiro-composer .chihiro-send {
    background: rgba(0, 0, 0, 0.08);
    color: #171717;
}
.chihiro-composer .chihiro-plus:hover,
.chihiro-composer .chihiro-plus.active,
.chihiro-composer .chihiro-input-face:hover,
.chihiro-composer .chihiro-input-face.active {
    background: rgba(127, 127, 127, 0.18);
    color: var(--color-font);
}
.chihiro-composer .chihiro-send:hover {
    filter: brightness(1.12);
}
.chihiro-composer .chihiro-plus-menu {
    position: absolute;
    left: 0;
    bottom: calc(100% + 8px);
    min-width: 148px;
    padding: 6px;
    background: var(--color-card);
    border: 1px solid var(--color-card-2);
    border-radius: 12px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.42);
    z-index: 40;
}
.chihiro-composer .chihiro-plus-menu button {
    appearance: none;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    margin: 0;
    padding: 8px 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--color-font);
    font-size: 13px;
    cursor: pointer;
    text-align: left;
}
.chihiro-composer .chihiro-plus-menu button:hover {
    background: var(--color-card-1);
}
.chihiro-composer svg {
    width: 16px;
    height: 16px;
    margin: 0;
    color: inherit;
}
.chihiro-composer .chihiro-send svg {
    color: inherit;
    fill: currentColor;
}
.chihiro-composer .chihiro-float-actions {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    position: absolute;
    right: 6px;
    bottom: calc(100% + 8px);
    z-index: 8;
    pointer-events: none;
}
.chihiro-composer .assistant-slot:has(.assistant-panel) {
    padding-bottom: 48px;
}
.chihiro-composer .chihiro-bot-think {
    position: absolute;
    right: 42px;
    bottom: 0;
    width: min(280px, 46vw);
    max-height: 160px;
    overflow: auto;
    padding: 8px 10px;
    border-radius: 12px;
    border: 1px solid rgba(127, 127, 127, 0.22);
    background: var(--color-card-1);
    color: var(--color-font);
    font-size: 12px;
    line-height: 1.45;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
    z-index: 5;
}
.chihiro-composer .chihiro-bot-think .row {
    display: flex;
    gap: 8px;
    margin-top: 8px;
}
.chihiro-composer .chihiro-reply-preview {
    display: flex;
    align-items: flex-start;
    position: relative;
    margin: 6px 8px 2px 12px;
    padding: 2px 28px 4px 10px;
}
.chihiro-composer .chihiro-reply-preview::before {
    content: '';
    position: absolute;
    left: 0;
    top: 3px;
    bottom: 4px;
    width: 2px;
    border-radius: 2px;
    background: #007aff;
}
.chihiro-composer .chihiro-reply-copy {
    min-width: 0;
    flex: 1;
}
.chihiro-composer .chihiro-reply-title {
    color: #007aff;
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
}
.chihiro-composer .chihiro-reply-text {
    color: var(--color-font-1);
    font-size: 13px;
    line-height: 18px;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.chihiro-composer .chihiro-reply-close {
    appearance: none;
    position: absolute;
    top: 0;
    right: 2px;
    width: 22px;
    height: 22px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--color-font-2);
    display: grid;
    place-items: center;
    cursor: pointer;
}
.chihiro-composer .chihiro-reply-close:hover {
    background: rgba(127, 127, 127, 0.16);
    color: var(--color-font);
}
.chihiro-composer .chihiro-attach {
    display: flex;
    gap: 8px;
    padding: 8px 10px 4px;
    overflow-x: auto;
}
.chihiro-composer .chihiro-attach::-webkit-scrollbar {
    display: none;
}
.chihiro-composer .chihiro-attach-item {
    position: relative;
    flex: 0 0 auto;
    width: 52px;
    height: 52px;
    border-radius: 10px;
    overflow: hidden;
    background: var(--color-card-2);
}
.chihiro-composer .chihiro-attach-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    cursor: pointer;
}
.chihiro-composer .chihiro-attach-x {
    appearance: none;
    position: absolute;
    top: 3px;
    right: 3px;
    width: 16px;
    height: 16px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    display: grid;
    place-items: center;
    cursor: pointer;
}
.chihiro-composer .chihiro-attach-x:hover {
    background: rgba(0, 0, 0, 0.75);
}
.chihiro-composer .chihiro-attach-x svg {
    width: 8px;
    height: 8px;
    color: #fff;
}
.chihiro-composer .chihiro-file-input {
    display: none;
}
.chihiro-composer .chihiro-jump-bottom {
    display: none;
    position: relative;
    right: auto;
    bottom: auto;
    width: 36px;
    height: 36px;
    pointer-events: none;
}
.chihiro-composer .chihiro-jump-bottom.is-on {
    display: flex;
    pointer-events: all;
}
.chihiro-composer .chihiro-jump-bottom > div {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #636366;
    display: grid;
    place-items: center;
    color: #fff;
    cursor: pointer;
    position: relative;
}
.chihiro-composer .chihiro-jump-bottom.is-on > div:hover {
    filter: brightness(1.12);
}
.chihiro-composer .chihiro-jump-bottom svg {
    fill: none;
    stroke: #fff;
    color: #fff;
}
.chihiro-composer .chihiro-jump-bottom span {
    position: absolute;
    top: -5px;
    right: -5px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 999px;
    background: #007aff;
    color: #fff;
    font-size: 10px;
    line-height: 16px;
    font-weight: 650;
    text-align: center;
    box-sizing: border-box;
}

.user-skin.chat-pan > div.more {
    background: transparent !important;
    border-top: 0 !important;
    box-shadow: none !important;
    padding: 8px 16px 14px !important;
    box-sizing: border-box !important;
}
.user-skin.chat-pan > div.more > .chihiro-composer {
    width: 100%;
}
.user-skin .more-detail,
.user-skin .select-tag,
.user-skin .replay-tag {
    display: none !important;
    height: 0 !important;
    overflow: hidden !important;
    padding: 0 !important;
    margin: 0 !important;
}
.user-skin.chat-pan > div.more .img-pan {
    display: none !important;
}
.user-skin.chat-pan > div.chat {
    margin-bottom: 70px;
}
</style>
