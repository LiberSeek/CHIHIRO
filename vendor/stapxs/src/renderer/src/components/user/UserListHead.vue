<!--
 * @FileDescription: 会话 / 联系人列表顶栏
-->

<template>
    <div class="chihiro-list-head">
        <div class="chihiro-list-tools">
            <label class="chihiro-list-search">
                <font-awesome-icon :icon="['fas', 'magnifying-glass']" />
                <input
                    :value="modelValue"
                    type="text"
                    :placeholder="$t('搜索')"
                    @input="onInput">
            </label>
            <div class="chihiro-list-plus-wrap">
                <button
                    type="button"
                    class="chihiro-list-plus"
                    :class="{ active: plusOpen }"
                    :title="$t('更多')"
                    @click.stop="togglePlus">
                    <font-awesome-icon :icon="['fas', 'plus']" />
                </button>
                <div v-if="plusOpen" class="chihiro-list-plus-menu" @click.stop>
                    <button type="button" @click="createGroup">
                        <font-awesome-icon :icon="['fas', 'user-group']" />
                        <span>{{ $t('创建群聊') }}</span>
                    </button>
                    <button type="button" @click="addFriendOrGroup">
                        <font-awesome-icon :icon="['fas', 'user-plus']" />
                        <span>{{ $t('加好友/群') }}</span>
                    </button>
                </div>
            </div>
        </div>
        <div class="chihiro-inbox-tabs">
            <button type="button" :class="{ 'is-on': tab === 'messages' }" @click="goMessages">
                {{ $t('消息') }}
            </button>
            <button type="button" :class="{ 'is-on': tab === 'friends' }" @click="goFriends">
                {{ $t('联系人') }}
            </button>
            <span class="chihiro-inbox-tabs-spacer" />
            <button type="button" :class="{ 'is-on': tab === 'workbench' }" @click="goWorkbench">
                {{ $t('工作台') }}
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { onBeforeUnmount, onMounted, ref } from 'vue'
    import { i18n } from '@renderer/main'
    import { PopInfo, PopType } from '@renderer/function/base'

    defineOptions({ name: 'UserListHead' })

    const $t = i18n.global.t

    const props = defineProps<{
        modelValue: string
        tab: 'messages' | 'friends' | 'workbench'
    }>()
    const emit = defineEmits<{
        'update:modelValue': [value: string]
    }>()

    const plusOpen = ref(false)
    function onInput(event: Event) {
        emit('update:modelValue', (event.target as HTMLInputElement).value)
    }

    function togglePlus() {
        plusOpen.value = !plusOpen.value
    }

    function closePlus() {
        plusOpen.value = false
    }

    function createGroup() {
        closePlus()
        new PopInfo().add(PopType.INFO, $t('暂不支持创建群聊'), true)
    }

    function addFriendOrGroup() {
        closePlus()
        new PopInfo().add(PopType.INFO, $t('暂不支持加好友/群'), true)
    }

    function goMessages() {
        closePlus()
        if (props.tab === 'messages') return
        document.getElementById('bar-msg')?.click()
    }

    function goFriends() {
        closePlus()
        if (props.tab === 'friends') return
        document.getElementById('bar-friends')?.click()
    }

    function goWorkbench() {
        closePlus()
        if (props.tab === 'workbench') return
        document.getElementById('bar-workbench')?.click()
    }

    function onDocClick() {
        closePlus()
    }

    onMounted(() => {
        window.addEventListener('click', onDocClick)
    })
    onBeforeUnmount(() => {
        window.removeEventListener('click', onDocClick)
    })
</script>


<style>
/* chihiro-moved-from-user-css */
#base-app .friend-list > div:first-child,
#base-app .chihiro-list-head {
    margin: 0 !important;
    padding: 8px 8px 0 !important;
    position: relative;
    z-index: 5;
    flex-shrink: 0;
}
.chihiro-list-tools {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 4px 8px;
}
.chihiro-list-search {
    flex: 1;
    min-width: 0;
    height: 32px !important;
    min-height: 32px;
    margin: 0 !important;
    padding: 0 12px !important;
    align-items: center;
    display: flex;
    box-sizing: border-box;
    background: rgba(127, 127, 127, 0.12) !important;
    border: 1px solid transparent !important;
    border-radius: 16px !important;
    opacity: 1 !important;
}
.chihiro-list-search:focus-within {
    border-color: rgba(0, 122, 255, 0.45) !important;
    background: var(--color-card) !important;
}
.chihiro-list-search > svg {
    order: -1;
    margin: 0 8px 0 0 !important;
    height: 12px !important;
    width: 12px;
    color: var(--color-font-2) !important;
    flex-shrink: 0;
}
.chihiro-list-search > input {
    background: transparent !important;
    font-size: 13px !important;
    padding: 0 !important;
    height: 100% !important;
    width: 100%;
    margin: 0;
    border: 0;
    color: var(--color-font);
    outline: none;
}
.chihiro-list-search > input::placeholder {
    color: var(--color-font-2);
    opacity: 0.85;
}
.chihiro-list-plus-wrap {
    position: relative;
    flex-shrink: 0;
}
.chihiro-list-plus {
    appearance: none;
    width: 32px;
    height: 32px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--color-font-1);
    display: grid;
    place-items: center;
    cursor: pointer;
}
.chihiro-list-plus:hover,
.chihiro-list-plus.active {
    background: rgba(127, 127, 127, 0.16);
    color: var(--color-font);
}
.chihiro-list-plus svg {
    width: 14px;
    height: 14px;
}
.chihiro-list-plus-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    min-width: 148px;
    padding: 6px;
    background: var(--color-card);
    border: 1px solid var(--color-card-2);
    border-radius: 12px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.42);
    z-index: 40;
}
.chihiro-list-plus-menu button {
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
.chihiro-list-plus-menu button:hover {
    background: var(--color-card-1);
}
.chihiro-list-plus-menu button svg {
    width: 14px !important;
    height: 14px !important;
    color: var(--color-font-1) !important;
}
.chihiro-inbox-tabs {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 8px 8px;
    border-bottom: 1px solid rgba(127, 127, 127, 0.14);
}
.chihiro-inbox-tabs-spacer {
    flex: 1;
    min-width: 8px;
}
.chihiro-inbox-tabs button {
    appearance: none;
    background: none;
    border: 0;
    color: var(--color-font-2);
    font-size: 13px;
    padding: 4px 0 8px;
    cursor: pointer;
    position: relative;
}
.chihiro-inbox-tabs button.is-on {
    color: var(--color-font);
    font-weight: 600;
}
.chihiro-inbox-tabs button.is-on::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    background: var(--color-main);
    border-radius: 2px;
}
</style>
