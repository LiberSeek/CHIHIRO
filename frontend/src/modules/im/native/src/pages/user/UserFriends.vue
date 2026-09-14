<!--
 * @FileDescription: 联系人列表页面
 * @Author: Stapxs
 * @Date:
 *      2022/08/14
 *      2022/12/12
 * @Version:
 *      1.0 - 初始版本
 *      1.5 - 重构为 ts 版本，代码格式优化
-->

<template>
    <div class="friend-view">
        <div id="friend-list" :class="'friend-list' + (uiStore.openSideBar ? ' open' : '')">
            <UserListHead v-model="searchInfo" tab="friends" />
            <div :class="uiStore.openSideBar ? 'open' : ''">
                <template v-if="contactStore.showList.length <= 0">
                    <button
                        type="button"
                        class="chihiro-contact-link"
                        :class="{ 'is-on': noticeKind === 'friend' }"
                        @click="openNotice('friend')">
                        <span>{{ $t('新朋友') }}</span>
                        <font-awesome-icon :icon="['fas', 'angle-right']" />
                    </button>
                    <button
                        type="button"
                        class="chihiro-contact-link"
                        :class="{ 'is-on': noticeKind === 'group' }"
                        @click="openNotice('group')">
                        <span>{{ $t('新群聊') }}</span>
                        <font-awesome-icon :icon="['fas', 'angle-right']" />
                    </button>
                    <div class="chihiro-contact-split" />
                    <div class="chihiro-contact-switch">
                        <button
                            type="button"
                            :class="{ 'is-on': contactTab === 'friend' }"
                            @click="contactTab = 'friend'">
                            {{ $t('好友') }}
                        </button>
                        <button
                            type="button"
                            :class="{ 'is-on': contactTab === 'group' }"
                            @click="contactTab = 'group'">
                            {{ $t('群聊') }}
                        </button>
                    </div>
                    <div
                        v-for="sec in currentSections"
                        :key="sec.id"
                        :class="'list exp-body' + (classStatus[sec.id] ? ' open' : '')">
                        <header
                            :title="sec.title"
                            class="exp-header"
                            :class="{ open: classStatus[sec.id] }"
                            @click="classClick(sec.id)">
                            <font-awesome-icon
                                :icon="['fas', classStatus[sec.id] ? 'angle-down' : 'angle-right']" />
                            <span>{{ sec.title }}</span>
                            <a>{{ sec.items.length }}</a>
                        </header>
                        <div>
                            <FriendBody
                                v-for="item in sec.items"
                                :key="'fb-' + (item.user_id ? item.user_id : item.group_id)"
                                :data="item"
                                :select="chatStore.chatInfo.show.id === (item.user_id || item.group_id) && chatStore.chatInfo.show.type === (item.user_id ? 'user' : 'group')"
                                from="friend"
                                role="button" tabindex="0"
                                @keydown.enter.prevent="userClick(item, $event)"
                                @keydown.space.prevent="inspectContact(item)"
                                @click="scheduleInspectContact(item)"
                                @dblclick.stop.prevent="openContactChatFromPointer(item, $event)" />
                        </div>
                    </div>
                </template>
                <div v-else class="list">
                    <div>
                        <FriendBody v-for="item in contactStore.showList"
                            :key="'fb-' + (item.user_id ? item.user_id : item.group_id)"
                            :data="item" from="friend"
                            :select="chatStore.chatInfo.show.id === (item.user_id || item.group_id) && chatStore.chatInfo.show.type === (item.user_id ? 'user' : 'group')"
                            role="button" tabindex="0"
                            @keydown.enter.prevent="userClick(item, $event)"
                            @keydown.space.prevent="inspectContact(item)"
                            @click="scheduleInspectContact(item)"
                            @dblclick.stop.prevent="openContactChatFromPointer(item, $event)" />
                    </div>
                </div>
            </div>
        </div>
        <div :class="'friend-list-space' + (uiStore.openSideBar ? ' open' : '')">
            <div v-if="!loginInfo.status || chatStore.chatInfo.show.id == 0" class="ss-card">
                <font-awesome-icon :icon="['fas', 'inbox']" />
                <span>{{ $t('选择联系人开始聊天') }}</span>
            </div>
            <div v-else-if="chatStore.messageList.length > 0" class="ss-card cd">
                <font-awesome-icon :icon="['fas', 'angles-right']" />
                <span>(っ≧ω≦)っ</span>
                <span>{{ $t('别划了别划了被看见了啦') }}</span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { ref, computed, watch, onBeforeUnmount } from 'vue'

    import FriendBody from '@renderer/components/user/UserFriendBody.vue'
    import UserListHead from '@renderer/components/user/UserListHead.vue'

    import {
        BaseChatInfoElem,
        UserFriendElem,
        UserGroupElem,
    } from '@renderer/function/elements/information'

    import { login as loginInfo } from '@renderer/function/connect'
    import { run as runOpt } from '@renderer/function/option'
    import { backend } from '@renderer/runtime/backend'
    import { matchPinyin } from '@renderer/function/utils/pinyin'
    import { i18n } from '@chihiro/im-native/host'
    import { useUIStore } from '@renderer/state/ui'
    import { useSettingsStore } from '@renderer/state/settings'
    import { useContactStore } from '@renderer/state/contact'
    import { useChatStore } from '@renderer/state/chat'
    import { useAuthStore } from '@renderer/state/auth'

    defineOptions({ name: 'UserFriends' })

    const $t = i18n.global.t
    const uiStore = useUIStore()
    const settingsStore = useSettingsStore()
    const contactStore = useContactStore()
    const chatStore = useChatStore()
    const authStore = useAuthStore()
    const { list } = defineProps<{ list: (UserFriendElem & UserGroupElem)[] }>()
    const emit = defineEmits<{
        userClick: [data: BaseChatInfoElem]
        loadHistory: [data: BaseChatInfoElem]
        contactInfo: [data: BaseChatInfoElem]
    }>()

    const isSearch = ref(false)
    const searchInfo = ref('')
    const classStatus = ref<{ [key: string]: boolean }>({})
    const contactTab = ref<'friend' | 'group'>('friend')

    type ContactItem = UserFriendElem & UserGroupElem
    type ContactSection = { id: string; title: string; items: ContactItem[] }

    const noticeKind = computed<'friend' | 'group' | ''>(() => {
        const id = Number(chatStore.chatInfo.show.id)
        if (id === -10010) return 'friend'
        if (id === -10011) return 'group'
        return ''
    })

    function isFriend(item: ContactItem) {
        return !!item.user_id
    }
    function isGroup(item: ContactItem) {
        return !!item.group_id && !item.user_id
    }
    function isSpecialCare(item: ContactItem) {
        return item.class_id == 9999 || item.class_name === '特别关心'
    }
    function isUnnamedGroup(item: ContactItem) {
        const name = String(item.group_name || '').trim()
        return !name || name === String(item.group_id)
    }
    function pinnedIdSet() {
        const info = settingsStore.sysConfig.top_info as { [key: string]: number[] } | null
        const uin = authStore.loginInfo.uin
        const ids = (info && uin != null ? info[uin] : undefined) || []
        return new Set(ids.map((id) => Number(id)))
    }
    function isPinnedGroup(item: ContactItem) {
        const id = Number(item.group_id)
        return item.always_top === true || pinnedIdSet().has(id)
    }
    function isCreatedGroup(item: ContactItem) {
        return item.admin_flag === true && (item as any).role === 'owner'
    }
    function isManagedGroup(item: ContactItem) {
        if (isCreatedGroup(item)) return false
        return item.admin_flag === true || (item as any).role === 'admin'
    }

    const friendSections = computed<ContactSection[]>(() => {
        const friends = contactStore.userList.filter(isFriend)
        const care = friends.filter(isSpecialCare)
        const mine = friends.filter((item) => !isSpecialCare(item))
        return [
            { id: 'care', title: $t('特别关心'), items: care },
            { id: 'friends', title: $t('我的好友'), items: mine },
        ]
    })

    const groupSections = computed<ContactSection[]>(() => {
        const groups = contactStore.userList.filter(isGroup)
        const pinned: ContactItem[] = []
        const unnamed: ContactItem[] = []
        const created: ContactItem[] = []
        const managed: ContactItem[] = []
        const joined: ContactItem[] = []
        groups.forEach((item) => {
            if (isPinnedGroup(item)) pinned.push(item)
            else if (isUnnamedGroup(item)) unnamed.push(item)
            else if (isCreatedGroup(item)) created.push(item)
            else if (isManagedGroup(item)) managed.push(item)
            else joined.push(item)
        })
        return [
            { id: 'pinned', title: $t('置顶群聊'), items: pinned },
            { id: 'unnamed', title: $t('未命名群聊'), items: unnamed },
            { id: 'created', title: $t('我创建的群聊'), items: created },
            { id: 'managed', title: $t('我管理的群聊'), items: managed },
            { id: 'joined', title: $t('我加入的群聊'), items: joined },
        ]
    })

    const currentSections = computed(() => {
        return contactTab.value === 'friend' ? friendSections.value : groupSections.value
    })

    watch(searchInfo, (value) => {
        applySearch(value)
    })


    let contactInspectTimer: ReturnType<typeof setTimeout> | undefined

    function cancelScheduledContactInspect() {
        if (contactInspectTimer !== undefined) {
            globalThis.clearTimeout(contactInspectTimer)
            contactInspectTimer = undefined
        }
    }

    function scheduleInspectContact(data: UserFriendElem & UserGroupElem) {
        cancelScheduledContactInspect()
        contactInspectTimer = globalThis.setTimeout(() => {
            contactInspectTimer = undefined
            inspectContact(data)
        }, 180)
    }

    function openContactChatFromPointer(data: UserFriendElem & UserGroupElem, event: Event) {
        cancelScheduledContactInspect()
        userClick(data, event)
    }

    onBeforeUnmount(cancelScheduledContactInspect)

    function getShowName(data: UserFriendElem & UserGroupElem) {
        const group = data.group_name
        const remark = data.remark
        const nickname = data.nickname
        if (group) return group
        else {
            if (!remark || remark == nickname) {
                return nickname
            } else {
                return remark + '（' + nickname + '）'
            }
        }
    }

    function openLeftBar() {
        uiStore.openSideBar = !uiStore.openSideBar
    }

    function classClick(id: string) {
        if (classStatus.value[id]) {
            classStatus.value[id] = !classStatus.value[id]
        } else {
            classStatus.value[id] = true
        }
    }

    function openNotice(kind: 'friend' | 'group') {
        const back = {
            type: 'user',
            id: kind === 'friend' ? -10010 : -10011,
            name: kind === 'friend' ? $t('新朋友') : $t('新群聊'),
            avatar: '',
        } as BaseChatInfoElem
        emit('userClick', back)
        settingsStore.sysConfig.chatview_name = 'UserSystemNotice'
        runOpt('chatview_name', 'UserSystemNotice')
    }

    function userClick(data: UserFriendElem & UserGroupElem, event: Event) {
        const sender = event.currentTarget as HTMLDivElement
        if (uiStore.openSideBar) {
            openLeftBar()
        }
        isSearch.value = false
        searchInfo.value = ''
        contactStore.showList = [] as any[]

        const back = {
            type: data.user_id ? 'user' : 'group',
            id: data.user_id ? data.user_id : data.group_id,
            name: getShowName(data),
            avatar: data.user_id? 'https://q1.qlogo.cn/g?b=qq&s=0&nk=' + data.user_id: 'https://p.qlogo.cn/gh/' +
                  data.group_id + '/' + data.group_id + '/0',
            jump: sender.dataset.jump,
        } as BaseChatInfoElem
        // 更新聊天框
        emit('userClick', back)
        settingsStore.sysConfig.chatview_name = 'UserChat'
        runOpt('chatview_name', 'UserChat')
        contactStore.baseOnMsgList.set(back.id, data)
        // 获取历史消息
        if(!uiStore.nowGetHistory) {
            emit('loadHistory', back)
        }
        // 切换标签卡
        const barMsg = document.getElementById('bar-msg')
        if (barMsg !== null) {
            barMsg.click()
        }
    }

    function inspectContact(data: UserFriendElem & UserGroupElem) {
        const info = {
            type: data.user_id ? 'user' : 'group',
            id: data.user_id ? data.user_id : data.group_id,
            name: getShowName(data),
            avatar: data.user_id ? 'https://q1.qlogo.cn/g?b=qq&s=0&nk=' + data.user_id : 'https://p.qlogo.cn/gh/' +
                data.group_id + '/' + data.group_id + '/0',
        } as BaseChatInfoElem
        contactStore.baseOnMsgList.set(info.id, data)
        emit('contactInfo', info)
    }

    function applySearch(raw: string) {
        const value = raw.toLocaleLowerCase()
        if (value !== '') {
            isSearch.value = true
            contactStore.showList = list.filter(
                (item: UserFriendElem & UserGroupElem) => {
                    const name = (
                        item.user_id? item.nickname + item.remark: item.group_name
                    ).toLowerCase()
                    if (name.includes(value)) return true
                    const id = item.user_id? item.user_id: item.group_id
                    if (id.toString() === value) return true
                    if (item.py_name && matchPinyin(item.py_name, value)) return true
                    return false
                },
            )
        } else {
            isSearch.value = false
            contactStore.showList = [] as any[]
        }
        if(backend.isDesktop()) {
            backend.call(undefined, 'sys:flushFriendSearch', false,
                contactStore.showList.map((item) => {
                    return {
                        id: item.user_id ? item.user_id : item.group_id,
                        name: getShowName(item)
                    }
                }))
        }
    }
</script>

<style scoped>
    .exp-body > div {
        /* transition: transform .3s;
    transform-origin: top; */
        transform: scaleY(0);
        height: 0;
    }
    .exp-body.open > div {
        transform: scaleY(1);
        height: unset;
    }
    .exp-body > header > div {
        transition:
            margin-right 0.3s,
            transform 0.3s;
        transform: scaleY(0);
        margin-right: 0;
        width: 0;
    }
    .exp-body.open > header > div {
        transform: scaleY(1);
        margin-right: 8px;
        width: 3px;
    }

    .exp-header {
        color: var(--color-font-1);
        align-items: center;
        border-radius: 8px;
        cursor: pointer;
        margin: 2px 8px;
        padding: 8px 10px;
        min-height: 34px;
        display: flex;
        box-sizing: border-box;
        gap: 8px;
    }
    .exp-header:hover {
        background: rgba(127, 127, 127, 0.12);
    }
    .exp-header > svg {
        width: 10px;
        height: 10px;
        color: var(--color-font-2);
        flex-shrink: 0;
    }
    .exp-header > span {
        flex: 1;
        font-size: 13px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .exp-header > a {
        color: var(--color-font-2);
        font-size: 12px;
        background: transparent;
        padding: 0;
        line-height: 16px;
    }

    @media (max-width: 700px) {
        .exp-header:not(.open) {
            display: flex;
        }
    }
    @media (max-width: 500px) {
        .exp-header > span {
            display: block !important;
        }
    }
</style>


<style>
/* chihiro-moved-from-user-css */
#base-app .exp-header {
    margin: 2px 8px !important;
    padding: 8px 10px !important;
    border-radius: 8px !important;
    min-height: 34px;
}
#base-app .exp-header > span {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-font-1);
}
#base-app .exp-header > a {
    font-size: 12px !important;
    background: transparent !important;
    padding: 0 !important;
}
#base-app .exp-header > svg {
    width: 10px;
    height: 10px;
    color: var(--color-font-2);
}
.chihiro-contact-link {
    appearance: none;
    display: flex;
    align-items: center;
    width: calc(100% - 16px);
    margin: 2px 8px;
    padding: 10px 12px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--color-font);
    font-size: 14px;
    cursor: pointer;
    box-sizing: border-box;
    text-align: left;
}
.chihiro-contact-link:hover,
.chihiro-contact-link.is-on {
    background: rgba(127, 127, 127, 0.16);
}
.chihiro-contact-link span {
    flex: 1;
}
.chihiro-contact-link svg {
    width: 10px;
    height: 10px;
    color: var(--color-font-2);
}
.chihiro-contact-split {
    height: 1px;
    margin: 8px 16px;
    background: rgba(127, 127, 127, 0.16);
}
.chihiro-contact-switch {
    display: flex;
    margin: 4px 12px 10px;
    padding: 3px;
    background: rgba(127, 127, 127, 0.14);
    border-radius: 10px;
}
.chihiro-contact-switch button {
    appearance: none;
    flex: 1;
    height: 28px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--color-font-2);
    font-size: 13px;
    cursor: pointer;
}
.chihiro-contact-switch button.is-on {
    background: var(--color-card);
    color: var(--color-font);
    font-weight: 600;
}
</style>
