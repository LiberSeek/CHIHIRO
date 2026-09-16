<!--
 - @FileDescription: 设置页面（群/好友设置页面）
 - @Author: Stapxs
 - @Date: 2023/2/7
 - @Version: 1.0 - 初始版本
-->

<template>
    <div class="info-pan-set">
        <template v-if="type == 'group'">
            <div class="opt-group-card">
                <div v-if="chatStore.chatInfo.info.me_info.role == 'owner' ||
                         chatStore.chatInfo.info.me_info.role == 'admin'"
                    class="opt-item">
                    <div>
                        <label for="opt-info-group-name">{{ $t('群聊名称') }}</label>
                        <span>{{ $t('更改后将同步给所有成员') }}</span>
                    </div>
                    <input id="opt-info-group-name"
                        v-model="chatStore.chatInfo.show.name"
                        class="ss-input"
                        type="text"
                        maxlength="30"
                        autocomplete="off"
                        spellcheck="false"
                        :placeholder="$t('输入群名称')"
                        @keyup="setGroupName">
                </div>
                <div class="opt-item">
                    <div>
                        <label for="opt-info-group-card">{{ $t('我的群昵称') }}</label>
                        <span>{{ $t('仅在本群显示') }}</span>
                    </div>
                    <input id="opt-info-group-card"
                        v-model="chatStore.chatInfo.info.me_info.card"
                        class="ss-input"
                        type="text"
                        maxlength="16"
                        autocomplete="off"
                        spellcheck="false"
                        :placeholder="$t('未设置')"
                        @change="setGroupCard">
                </div>
                <div class="opt-item">
                    <div>
                        <label for="opt-info-group-notice">{{ $t('消息通知') }}</label>
                        <span>{{ $t('关闭后该群新消息将静音') }}</span>
                    </div>
                    <label class="ss-switch">
                        <input id="opt-info-group-notice"
                            v-model="canGroupNotice"
                            type="checkbox"
                            name="opt_group_notice"
                            @change="setGroupNotice">
                        <div>
                            <div />
                        </div>
                    </label>
                </div>
            </div>

            <button type="button" class="ss-button info-leave-btn" @click="leaveGroup()">
                {{ $t('退出群聊') }}
            </button>
        </template>
    </div>
</template>

<script lang="ts" setup>
    import { useUIStore } from '@renderer/state/ui'
    import { useAuthStore } from '@renderer/state/auth'
    import { useContactStore } from '@renderer/state/contact'
    import { useChatStore } from '@renderer/state/chat'
    import { Connector } from '@renderer/function/connect'
    import { changeGroupNotice, reloadUsers } from '@renderer/function/utils/appUtil'
    import { canGroupNotice } from '@renderer/function/utils/msgUtil'
    import { i18n } from '@chihiro/im-native/host'

    defineOptions({ name: 'UserOptInfo' })

    const authStore = useAuthStore()
    const contactStore = useContactStore()
    const chatStore = useChatStore()
    const uiStore = useUIStore()
    const $t = i18n.global.t

    const props = defineProps<{
        type: string
        chat: any
    }>()

    const emit = defineEmits<{
        'update_mumber_card': [event: Event, info: any]
    }>()

    /**
     * 设置群消息通知
     * @param event 输入事件
     */
    function setGroupNotice(event: Event) {
        const status = (event.target as HTMLInputElement).checked
        changeGroupNotice(props.chat.show.id, status)
    }

    /**
     * 设置群名片
     * @param event 按键事件
     */
    function setGroupCard(event: Event) {
        emit('update_mumber_card', event, chatStore.chatInfo.info.me_info)
    }

    /**
     * 设置群名
     * @param event 按键事件
     */
    function setGroupName(event: KeyboardEvent) {
        if (
            event.key === 'Enter' &&
            chatStore.chatInfo.show.name != ''
        ) {
            Connector.send(
                'set_group_name',
                {
                    group_id: props.chat.show.id,
                    group_name: chatStore.chatInfo.show.name,
                },
                'setGroupName',
            )
        }
    }

    /**
     * 退出群聊
     */
    function leaveGroup() {
        const popInfo = {
            html: '<span>' + $t('确定要退出群聊吗？') + '</span>',
            button: [
                {
                    text: $t('确定'),
                    fun: () => {
                        if (authStore.jsonMap.leave_group?.name) {
                            Connector.send(authStore.jsonMap.leave_group?.name,
                                { group_id: props.chat.show.id },
                                'leaveGroup')
                        }
                        // 从消息列表中删除该群聊
                        contactStore.baseOnMsgList.delete(props.chat.show.id)
                        // 关闭群聊窗口
                        chatStore.chatInfo.show.id = 0
                        // 刷新好友/群列表
                        reloadUsers()
                        uiStore.popBoxList.shift()
                    },
                },
                {
                    text: $t('取消'),
                    master: true,
                    fun: () => {
                        uiStore.popBoxList.shift()
                    },
                },
            ],
        }
        uiStore.popBoxList.push(popInfo)
    }
</script>

<style scoped>
    .info-pan-set {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 4px 0 12px;
    }
    .opt-group-card {
        background: var(--color-card-1);
    }
    .opt-item {
        gap: 12px;
    }
    .ss-input {
        box-sizing: border-box;
        width: min(220px, 52%);
        min-width: 132px;
        height: 32px;
        margin: 0;
        padding: 0 14px;
        border: 0;
        border-radius: 999px;
        background: rgba(127, 127, 127, 0.16);
        color: var(--color-font);
        font-size: 0.82rem;
        line-height: 32px;
    }
    .ss-input::placeholder {
        color: var(--color-font-2);
    }
    .ss-input:focus {
        outline: none;
        background: rgba(127, 127, 127, 0.22);
        box-shadow: none;
    }
    .ss-switch {
        position: relative;
        display: inline-flex;
        flex: 0 0 auto;
        align-items: center;
        width: 40px;
        min-width: 40px;
        height: 22px;
        margin: 0;
        cursor: pointer;
    }
    .ss-switch input {
        position: absolute;
        inset: 0;
        z-index: 1;
        margin: 0;
        opacity: 0;
        cursor: pointer;
        appearance: none;
        display: block !important;
    }
    .ss-switch > div {
        position: relative;
        width: 40px;
        height: 22px;
        border-radius: 11px;
        background: rgba(127, 127, 127, 0.38);
        transition: background 0.2s;
    }
    .ss-switch > div > div {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 18px;
        height: 18px;
        margin: 0 !important;
        border: 0 !important;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
        float: none;
        transition: transform 0.2s;
    }
    .ss-switch input:checked ~ div {
        background: var(--color-main);
    }
    .ss-switch input:checked ~ div > div {
        border: 0 !important;
        margin: 0 !important;
        transform: translateX(18px);
    }
    .info-leave-btn {
        display: inline-flex;
        box-sizing: border-box;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 36px;
        margin: 0;
        padding: 0 16px;
        border: 0;
        border-radius: 999px;
        background: rgba(255, 69, 58, 0.12);
        color: #ff453a;
        box-shadow: none;
        font-size: 0.86rem;
        font-weight: 600;
        line-height: 1;
        cursor: pointer;
    }
    .info-leave-btn:hover {
        background: rgba(255, 69, 58, 0.18);
    }
    @media (max-width: 680px) {
        .opt-item {
            flex-wrap: wrap;
        }
        .ss-input {
            width: 100%;
            min-width: 0;
            max-width: none;
        }
    }
</style>
