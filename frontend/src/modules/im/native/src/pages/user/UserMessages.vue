<!--
 * @FileDescription: 消息列表页面
 * @Author: Stapxs
 * @Date:
 *      2022/08/14
 *      2022/12/14
 * @Version:
 *      1.0 - 初始版本
 *      1.5 - 重构为 ts 版本，代码格式优化
-->

<template>
    <div class="friend-view">
        <div class="friend-list-container">
            <div id="message-list"
                :class="'friend-list' + (uiStore.openSideBar ? ' open' : '')">
                <UserListHead v-model="searchInfo" tab="messages" />
                <div class="chihiro-msg-stack" :class="{ 'is-assist': showGroupAssist }">
                    <div class="chihiro-msg-track">
                        <div class="chihiro-msg-pane">
                            <TransitionGroup
                                id="message-list-body"
                                name="onmsg"
                                tag="div"
                                :class="uiStore.openSideBar ? ' open' : ''">
                                <FriendBody
                                    v-if="showAssistEntry"
                                    key="inMessage--10001"
                                    :select="false"
                                    from="message"
                                    :data="{
                                        user_id: -10001,
                                        nickname: $t('群助手'),
                                        remark: $t('群助手'),
                                        time: contactStore.groupAssistList[0].time,
                                        unread: assistUnread,
                                        new_msg: assistUnread > 0,
                                        raw_msg: contactStore.groupAssistList[0].group_name + ': ' +
                                            (contactStore.groupAssistList[0].raw_msg_base ?? '')
                                    }"
                                    @click="showGroupAssistCheck" />
                                <FriendBody v-if="showSystemNotice"
                                    key="inMessage--10000"
                                    :select="chat.show.id === -10000"
                                    :menu="menuSelect && menuSelect.user_id === -10000"
                                    :data="{
                                        user_id: -10000,
                                        always_top: true,
                                        nickname: $t('系统通知'),
                                        remark: $t('系统通知'),
                                        raw_msg: systemNoticeComment
                                    }"
                                    @click="systemNoticeClick"
                                    @contextmenu.prevent="systemNoticeMenuShow($event)"
                                    @touchstart="systemNoticeMenuStart($event)"
                                    @touchmove="showMenuMove"
                                    @touchend="showMenuEnd" />
                                <FriendBody
                                    v-for="item in filteredOnMsgList"
                                    :key="'inMessage-' + (item.user_id ? item.user_id : item.group_id)"
                                    :select="chat.show.id === item.user_id || (chat.show.id === item.group_id && chat.group_name != '')"
                                    :menu="menuSelect === item"
                                    :data="item"
                                    from="message"
                                    @contextmenu.prevent="listMenuShow($event, item)"
                                    @click="userClick(item)"
                                    @touchstart="showMenuStart($event, item)"
                                    @touchmove="showMenuMove"
                                    @touchend="showMenuEnd" />
                            </TransitionGroup>
                        </div>
                        <div class="chihiro-assist-pane">
                            <div class="chihiro-assist-head">
                                <button type="button" @click="showGroupAssist = false">
                                    <font-awesome-icon :icon="['fas', 'angle-left']" />
                                    <span>{{ $t('返回') }}</span>
                                </button>
                                <span class="chihiro-assist-title">{{ $t('群助手') }}</span>
                            </div>
                            <TransitionGroup
                                id="group-assist-message-list-body"
                                name="onmsg"
                                tag="div"
                                :class="uiStore.openSideBar ? ' open' : ''">
                                <FriendBody
                                    v-for="item in filteredAssistList"
                                    :key="'inMessage-' + (item.user_id ? item.user_id : item.group_id)"
                                    :select="chat.show.id === item.user_id || (chat.show.id === item.group_id && chat.group_name != '')"
                                    :menu="menuSelect === item"
                                    :data="item"
                                    from="message"
                                    @contextmenu.prevent="listMenuShow($event, item)"
                                    @click="userClick(item)"
                                    @touchstart="showMenuStart($event, item)"
                                    @touchmove="showMenuMove"
                                    @touchend="showMenuEnd" />
                            </TransitionGroup>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <Teleport to="body">
            <div v-if="listMenu.show" class="chihiro-list-menu-bg" @mousedown="closeListMenu">
                <div
                    class="chihiro-list-menu"
                    :style="{ left: menuPos.x + 'px', top: menuPos.y + 'px' }"
                    @mousedown.stop>
                    <template v-for="item in visibleMenuItems" :key="item.id">
                        <div v-if="item.id === 'remove'" class="chihiro-list-menu-sep" />
                        <button
                            type="button"
                            @click="onListMenu(item.id, $event)"
                            @mouseenter="item.id === 'group_notice' ? openNoticeSub($event) : noticeSub.show = false">
                            <font-awesome-icon :icon="item.icon" />
                            <span class="chihiro-list-menu-label">{{ item.name }}</span>
                            <span v-if="item.id === 'group_notice'" class="chihiro-list-menu-chevron">›</span>
                        </button>
                    </template>
                </div>
                <div
                    v-if="noticeSub.show"
                    class="chihiro-list-submenu"
                    :style="{ left: noticeSub.x + 'px', top: noticeSub.y + 'px' }"
                    @mousedown.stop>
                    <button
                        v-for="item in noticeSubItems"
                        :key="item.id"
                        type="button"
                        @click="onNoticeSub(item.id)">
                        <span class="chihiro-list-check" :class="{ 'is-on': item.id === currentNoticeMode }">✓</span>
                        <span>{{ item.name }}</span>
                    </button>
                </div>
            </div>
        </Teleport>
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
    import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
    import app, { i18n } from '@chihiro/im-native/host'
    import FriendBody from '@renderer/components/user/UserFriendBody.vue'
    import UserListHead from '@renderer/components/user/UserListHead.vue'
    import Option from '@renderer/function/option'

    import { useSettingsStore } from '@renderer/state/settings'
    import {
        SessionNoticeMode,
        UserFriendElem,
        UserGroupElem,
    } from '@renderer/function/elements/information'
    import { getRaw as getOpt, run as runOpt } from '@renderer/function/option'
    import { changeGroupNotice } from '@renderer/function/utils/appUtil'
    import { PopInfo, PopType } from '@renderer/function/base'
    import { library } from '@fortawesome/fontawesome-svg-core'
    import { login as loginInfo } from '@renderer/function/connect'
    import { getSessionNotice, getShowName, setSessionNotice, updateBaseOnMsgList } from '@renderer/function/utils/msgUtil'
    import { matchPinyin } from '@renderer/function/utils/pinyin'

    import {
        faBell,
        faBroom,
        faComment,
        faCopy,
        faThumbTack,
        faTrashCan,
        faUserGroup,
    } from '@fortawesome/free-solid-svg-icons'
    import { Notify } from '@renderer/function/notify'
    import { refreshFavicon } from '@renderer/function/favicon'
    import { useUIStore } from '@renderer/state/ui'
    import { useAuthStore } from '@renderer/state/auth'
    import { useContactStore } from '@renderer/state/contact'
    import { useChatStore } from '@renderer/state/chat'

    const $t = i18n.global.t

    defineOptions({ name: 'UserMessages' })

    const uiStore = useUIStore()
    const authStore = useAuthStore()
    const contactStore = useContactStore()
    const chatStore = useChatStore()
    const settingsStore = useSettingsStore()
    const props = defineProps<{ chat: any }>()
    const emit = defineEmits<{
        userClick: [data: any]
        loadHistory: [data: any]
    }>()

    const trRead = ref(false)
    const listMenu = ref({
        show: false,
        point: { x: 0, y: 0 },
    })
    const menuPos = ref({ x: 0, y: 0 })
    const menuSelect = ref<(UserFriendElem & UserGroupElem) | undefined>()
    const noticeSub = ref({ show: false, x: 0, y: 0 })
    const showMenu = ref(false)
    const showGroupAssist = ref(false)
    const searchInfo = ref('')

    const menuCatalog = computed(() => ({
        top: { id: 'top', name: $t('置顶'), icon: ['fas', 'thumbtack'] as [string, string] },
        canceltop: { id: 'canceltop', name: $t('取消置顶'), icon: ['fas', 'thumbtack'] as [string, string] },
        copy_id: { id: 'copy_id', name: '', icon: ['fas', 'copy'] as [string, string] },
        read: { id: 'read', name: $t('标记未读'), icon: ['fas', 'comment'] as [string, string] },
        group_notice: { id: 'group_notice', name: $t('群消息设置'), icon: ['fas', 'user-group'] as [string, string] },
        mute: { id: 'mute', name: $t('设置免打扰'), icon: ['fas', 'bell'] as [string, string] },
        remove: { id: 'remove', name: $t('从消息列表中移除'), icon: ['fas', 'trash-can'] as [string, string] },
        clear_system_notice: { id: 'clear_system_notice', name: $t('清空通知'), icon: ['fas', 'broom'] as [string, string] },
    }))

    const noticeSubItems = [
        { id: 'notify', name: $t('允许消息提醒') },
        { id: 'silent', name: $t('接收消息但不提醒') },
        { id: 'assist', name: $t('收进群助手且不提醒') },
        { id: 'block', name: $t('屏蔽群消息') },
        { id: 'batch', name: $t('批量管理群消息') },
    ]

    const visibleMenuItems = computed(() => {
        const item = menuSelect.value
        const catalog = menuCatalog.value
        if (!item) return []
        if (item.user_id === -10000) return [catalog.clear_system_notice]
        const ids: string[] = []
        ids.push(item.always_top ? 'canceltop' : 'top')
        const copy = { ...catalog.copy_id }
        copy.name = item.group_id ? $t('复制群号') : $t('复制QQ号')
        ids.push('copy_id')
        ids.push('read')
        if (item.group_id) ids.push('group_notice')
        else ids.push('mute')
        ids.push('remove')
        return ids.map((id) => id === 'copy_id' ? copy : catalog[id as keyof typeof catalog])
    })

    const currentNoticeMode = computed(() => {
        const item = menuSelect.value
        if (!item?.group_id) return ''
        return getSessionNotice(item.group_id) || ''
    })

    function convQuery() {
        return searchInfo.value.trim().toLocaleLowerCase()
    }

    function matchConv(item: UserFriendElem & UserGroupElem, q: string) {
        const name = (
            (item.user_id ? (item.nickname || '') + (item.remark || '') : (item.group_name || ''))
        ).toLowerCase()
        if (name.includes(q)) return true
        const id = item.user_id ? item.user_id : item.group_id
        if (id != null && String(id).includes(q)) return true
        if (item.py_name && matchPinyin(item.py_name, q)) return true
        return false
    }

    const filteredOnMsgList = computed(() => {
        const q = convQuery()
        const main = contactStore.onMsgList || []
        if (!q) return main
        const seen = new Set<string>()
        const out: (UserFriendElem & UserGroupElem)[] = []
        const push = (item: UserFriendElem & UserGroupElem) => {
            const id = String(item.user_id ? item.user_id : item.group_id)
            if (seen.has(id)) return
            seen.add(id)
            out.push(item)
        }
        main.filter((item) => matchConv(item, q)).forEach(push)
        ;(contactStore.groupAssistList || []).filter((item) => matchConv(item, q)).forEach(push)
        return out
    })

    const filteredAssistList = computed(() => {
        const q = convQuery()
        const list = contactStore.groupAssistList || []
        if (!q) return list
        return list.filter((item) => matchConv(item, q))
    })

    const showAssistEntry = computed(() => {
        if (!contactStore.groupAssistList || contactStore.groupAssistList.length <= 0) return false
        const q = convQuery()
        if (!q) return true
        return $t('群助手').toLocaleLowerCase().includes(q)
    })

    const showSystemNotice = computed(() => {
        if (!contactStore.systemNoticesList || Object.keys(contactStore.systemNoticesList).length <= 0) {
            return false
        }
        const q = convQuery()
        if (!q) return true
        return $t('系统通知').toLocaleLowerCase().includes(q)
    })

    const systemNoticeComment = computed(() => contactStore.systemNoticesList?.[0]?.comment ?? '')

    const assistUnread = computed(() => {
        return (contactStore.groupAssistList || []).reduce((sum, item) => {
            const n = Number(item.unread)
            if (n > 0) return sum + n
            return sum + (item.new_msg ? 1 : 0)
        }, 0)
    })

    function publishChihiroEmptyChat() {
        if (Number(chatStore.chatInfo.show.id) !== 0) return
        try {
            window.parent.postMessage({ source: 'chihiro-im', kind: 'chat', chat: null }, '*')
        } catch (e) {}
    }
    function onChihiroShell(ev: MessageEvent) {
        const data = ev.data
        if (!data || data.source !== 'chihiro-shell' || data.kind !== 'chat-sync') return
        publishChihiroEmptyChat()
    }
    watch(() => chatStore.chatInfo.show.id, publishChihiroEmptyChat, { immediate: true })
    watch(searchInfo, (value) => {
        if (value.trim()) showGroupAssist.value = false
    })

    onMounted(() => {
        library.add(faBell, faBroom, faComment, faCopy, faThumbTack, faTrashCan, faUserGroup)
        window.addEventListener('message', onChihiroShell)
    })
    onBeforeUnmount(() => {
        window.removeEventListener('message', onChihiroShell)
    })

    /**
     * 联系人点击事件
     * @param data 联系人对象
     */
    function userClick(data: UserFriendElem & UserGroupElem) {
        const id = data.user_id ? data.user_id : data.group_id
        if (!trRead.value && id != props.chat.show.id) {
            if (uiStore.openSideBar) {
                openLeftBar()
            }
            const back = {
                // 临时会话标志
                temp: data.group_name == '' ? data.group_id : undefined,
                type: data.user_id ? 'user' : 'group',
                id: id,
                name: getShowName(data.group_name || data.nickname, data.remark),
                avatar: data.user_id? 'https://q1.qlogo.cn/g?b=qq&s=0&nk=' +
                      data.user_id: 'https://p.qlogo.cn/gh/' +
                      data.group_id + '/' + data.group_id + '/0',
            }
            if (props.chat.id != back.id) {
                // 更新聊天框
                emit('userClick', back)
                // 获取历史消息
                if(!uiStore.nowGetHistory) {
                    emit('loadHistory', back)
                }
                // 重置消息面板
                // PS：这儿的作用是在运行时如果切换到了特殊面板，在点击联系人的时候可以切回来
                getOpt('chatview_name').then((chatViewName) => {
                    const getChatViewName = decodeURIComponent(chatViewName ?? '').
                        replaceAll('\\"', '')
                    if (settingsStore.sysConfig.chatview_name != '' &&
                            settingsStore.sysConfig.chatview_name != getChatViewName) {
                        settingsStore.sysConfig.chatview_name = getChatViewName
                        runOpt('chatview_name', getChatViewName)
                    }
                })
            }
            // 清除新消息标记
            const item = contactStore.baseOnMsgList.get(id)
            if(item) {
                if(item.new_msg) {
                    item.new_msg = false
                    contactStore.newMsgCount--
                }
                item.unread = 0
                item.highlight = undefined
                contactStore.baseOnMsgList.set(id, item)
                // 关闭所有通知
                new Notify().closeAll((item.group_id ?? item.user_id).toString())
            }
        }
    }

    /**
     * 显示系统通知菜单
     * @param event 鼠标事件
     */
    function systemNoticeMenuShow(event: Event) {
        const mouseEvent = event as MouseEvent
        listMenuShowRun({
            show: true,
            point: { x: mouseEvent.clientX, y: mouseEvent.clientY },
        }, {
            user_id: -10000,
            nickname: $t('系统通知'),
            remark: $t('系统通知'),
            group_id: 0,
            group_name: '',
        })
    }

    /**
     * 系统通知菜单长按开始
     */
    function systemNoticeMenuStart(event: TouchEvent) {
        showMenuStart(event, { user_id: -10000 } as any)
    }

    /**
     * 清空系统通知
     */
    function clearSystemNotices() {
        contactStore.systemNoticesList = []
        new PopInfo().add(
            PopType.INFO,
            $t('已清空系统通知'),
        )
    }

    /**
     * 系统通知点击事件
     */
    function systemNoticeClick() {
        if (uiStore.openSideBar) {
            openLeftBar()
        }
        const back = {
            type: 'user',
            id: -10000,
            name: '系统消息',
        }
        emit('userClick', back)
        settingsStore.sysConfig.chatview_name = 'UserSystemNotice'
        runOpt('chatview_name', 'UserSystemNotice')
    }

    /**
     * 侧边栏操作
     */
    function openLeftBar() {
        uiStore.openSideBar = !uiStore.openSideBar
    }

    function closeListMenu() {
        listMenu.value.show = false
        noticeSub.value.show = false
        menuSelect.value = undefined
    }

    function copySessionId(item: UserFriendElem & UserGroupElem) {
        const id = item.group_id ? item.group_id : item.user_id
        const popInfo = new PopInfo()
        app.config.globalProperties.$copyText(String(id)).then(
            () => popInfo.add(PopType.INFO, $t('复制成功'), true),
            () => popInfo.add(PopType.ERR, $t('复制失败'), true),
        )
    }

    function applyGroupNotice(mode: SessionNoticeMode) {
        const item = menuSelect.value
        if (!item?.group_id) return
        setSessionNotice(item.group_id, mode)
        changeGroupNotice(item.group_id, mode === 'notify')
        if (mode === 'assist') showGroupAssist.value = true
        if (mode === 'notify' || mode === 'silent') showGroupAssist.value = false
    }

    function onListMenu(id: string, event?: MouseEvent) {
        const item = menuSelect.value
        if (!item) return
        if (id === 'group_notice') {
            if (event) openNoticeSub(event)
            return
        }
        switch (id) {
            case 'read': {
                if (!item.new_msg) {
                    item.new_msg = true
                    contactStore.newMsgCount++
                }
                if (!item.unread) item.unread = 1
                updateBaseOnMsgList()
                break
            }
            case 'remove': {
                const sid = item.user_id ? item.user_id : item.group_id
                contactStore.baseOnMsgList.delete(sid)
                updateBaseOnMsgList()
                refreshFavicon()
                break
            }
            case 'top':
                saveTop(item, true)
                break
            case 'canceltop':
                saveTop(item, false)
                break
            case 'copy_id':
                copySessionId(item)
                break
            case 'mute': {
                const sid = Number(item.user_id)
                const next = getSessionNotice(sid) === 'silent' ? undefined : 'silent'
                setSessionNotice(sid, next)
                break
            }
            case 'clear_system_notice':
                clearSystemNotices()
                break
        }
        closeListMenu()
    }

    function onNoticeSub(id: string) {
        if (id === 'batch') {
            new PopInfo().add(PopType.INFO, $t('暂不支持'))
            closeListMenu()
            return
        }
        applyGroupNotice(id as SessionNoticeMode)
        closeListMenu()
    }

    function openNoticeSub(event: MouseEvent) {
        const row = (event.currentTarget as HTMLElement).getBoundingClientRect()
        noticeSub.value = { show: true, x: row.right + 6, y: row.top }
        nextTick(() => {
            const el = document.querySelector('.chihiro-list-submenu') as HTMLElement | null
            if (!el) return
            const r = el.getBoundingClientRect()
            let x = row.right + 6
            let y = row.top
            if (x + r.width > window.innerWidth - 8) x = row.left - r.width - 6
            if (y + r.height > window.innerHeight - 8) y = window.innerHeight - r.height - 8
            if (x < 8) x = 8
            if (y < 8) y = 8
            noticeSub.value = { show: true, x, y }
        })
    }

    /**
     * 保存置顶信息
     * @param item 菜单选中项
     * @param value 是否置顶
     */
    function saveTop(item: any, value: boolean) {
        const id = authStore.loginInfo.uin
        const upId = item.user_id ? item.user_id : item.group_id
        // 完整的设置 JSON
        let topInfo = settingsStore.sysConfig.top_info as {
            [key: string]: number[]
        }
        if (topInfo == null || typeof topInfo !== 'object') {
            topInfo = {}
        }
        // 本人的置顶信息
        let topList = topInfo[id]
        // 操作
        if (value) {
            if (topList) {
                if (topList.indexOf(props.chat.show.id) < 0) {
                    topList.push(upId)
                }
            } else {
                topList = [upId]
            }
        } else {
            if (topList) {
                topList.splice(topList.indexOf(upId), 1)
            }
        }
        // 刷新设置
        if (topList) {
            topInfo[id] = topList
            Option.save('top_info', topInfo)
        }
        // 为消息列表内的对象刷新置顶标志
        item.always_top = value
        updateBaseOnMsgList()
        if(item.group_id && settingsStore.sysConfig.bubble_sort_user) {
            showGroupAssist.value = !value
        }
    }

    function listMenuShow(event: Event, item: UserFriendElem & UserGroupElem) {
        const ev = event as MouseEvent
        listMenuShowRun({
            show: true,
            point: { x: ev.clientX, y: ev.clientY },
        }, item)
    }

    function listMenuShowRun(info: { show: boolean, point: { x: number, y: number } }, item: UserFriendElem & UserGroupElem) {
        showMenu.value = false
        noticeSub.value.show = false
        menuSelect.value = item
        listMenu.value = { show: true, point: info.point }
        menuPos.value = { ...info.point }
        nextTick(() => {
            const el = document.querySelector('.chihiro-list-menu') as HTMLElement | null
            if (!el) return
            const r = el.getBoundingClientRect()
            let x = info.point.x
            let y = info.point.y
            if (x + r.width > window.innerWidth - 8) x = window.innerWidth - r.width - 8
            if (y + r.height > window.innerHeight - 8) y = window.innerHeight - r.height - 8
            if (x < 8) x = 8
            if (y < 8) y = 8
            menuPos.value = { x, y }
        })
    }

    /**
     * 显示群助手（仅滑动消息列表内层）
     */
    function showGroupAssistCheck() {
        showGroupAssist.value = true
    }

    function showMenuStart(
        event: TouchEvent,
        item: UserFriendElem & UserGroupElem,
    ) {
        const info = {
            show: true,
            point: {
                x: event.targetTouches[0].pageX,
                y: event.targetTouches[0].pageY,
            },
        }
        showMenu.value = true
        setTimeout(() => {
            if (showMenu.value) {
                listMenuShowRun(info, item)
                showMenu.value = false
            }
        }, 500)
    }

    function showMenuMove() {
        showMenu.value = false
    }

    function showMenuEnd() {
        showMenu.value = false
    }
</script>


<style>
    .friend-list-container {
        overflow: hidden;
        display: flex;
    }

    .onmsg-enter-active,
    .onmsg-leave-active,
    .onmsg-move {
        transition: transform 0.4s;
    }

    .menu div.item > a {
        font-size: 0.9rem !important;
    }
    .menu div.item > svg {
        margin: 3px 10px 3px 0 !important;
        font-size: 1rem !important;
    }

    .msg-menu-bg {
        background: transparent !important;
    }

    @media (max-width: 700px) {
        .friend-list-container {
            overflow: unset;
        }
        .menu {
            width: 140px !important;
        }
    }

    @media (max-width: 500px) {
        .friend-list-container {
            overflow: hidden;
        }
    }
</style>

<style>
/* chihiro-moved-from-user-css */
#base-app .friend-list > div.chihiro-msg-stack {
    width: 100% !important;
    height: auto !important;
    flex: 1 1 auto !important;
    min-height: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    display: flex !important;
    flex-direction: column;
}
.chihiro-msg-track {
    display: flex;
    flex-direction: row;
    width: 200%;
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
    transition: transform 0.28s ease;
}
.chihiro-msg-stack.is-assist .chihiro-msg-track {
    transform: translateX(-50%);
}
.chihiro-msg-pane,
.chihiro-assist-pane {
    width: 50%;
    height: 100%;
    flex: 0 0 50%;
    overflow: hidden;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
}
.chihiro-msg-pane > div::-webkit-scrollbar,
.chihiro-assist-pane > div:last-child::-webkit-scrollbar {
    display: none;
}
.chihiro-msg-pane > div,
.chihiro-assist-pane > div:last-child {
    flex: 1 1 auto;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 0 6px 8px;
    box-sizing: border-box;
}
.chihiro-assist-head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    padding: 6px 10px 4px;
    min-height: 36px;
    box-sizing: border-box;
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--color-card-1);
    border-bottom: none;
    color: var(--color-font);
}
.chihiro-assist-head button {
    appearance: none;
    width: auto;
    height: 28px;
    margin: 0;
    padding: 0 4px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--color-font);
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    font-size: 14px;
}
.chihiro-assist-head button:hover {
    background: rgba(127, 127, 127, 0.14);
    color: var(--color-font);
}
.chihiro-assist-head button svg {
    width: 12px;
    height: 12px;
}
.chihiro-assist-head .chihiro-assist-title {
    margin-left: auto;
    flex: 0 0 auto;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-font-1);
    white-space: nowrap;
}

.chihiro-list-menu-bg {
    position: fixed;
    inset: 0;
    z-index: 2400;
    background: transparent;
}
.chihiro-list-menu,
.chihiro-list-submenu {
    position: fixed;
    z-index: 2401;
    min-width: 168px;
    width: max-content;
    padding: 6px 0;
    border-radius: 8px;
    background: rgba(var(--color-bg-rgb), 0.88);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
    backdrop-filter: blur(50px);
    box-sizing: border-box;
}
.chihiro-list-menu button,
.chihiro-list-submenu button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    margin: 0;
    padding: 7px 14px;
    border: 0;
    background: transparent;
    color: var(--color-font);
    font-family: inherit;
    font-size: 13px;
    line-height: 1.3;
    text-align: left;
    white-space: nowrap;
    cursor: pointer;
}
.chihiro-list-menu button svg,
.chihiro-list-submenu button svg {
    width: 14px;
    height: 14px;
    flex: none;
    color: var(--color-font-1);
}
.chihiro-list-menu button:hover,
.chihiro-list-submenu button:hover {
    background: var(--color-main);
    color: var(--color-font-r);
}
.chihiro-list-menu button:hover svg,
.chihiro-list-submenu button:hover svg {
    color: var(--color-font-r);
}
.chihiro-list-menu-sep {
    height: 1px;
    margin: 4px 10px;
    background: rgba(127, 127, 127, 0.28);
}
.chihiro-list-menu-label {
    flex: 1;
}
.chihiro-list-menu-chevron {
    margin-left: 12px;
    opacity: 0.55;
    font-size: 12px;
}
.chihiro-list-check {
    width: 14px;
    flex: none;
    text-align: center;
    opacity: 0;
}
.chihiro-list-check.is-on {
    opacity: 1;
}
</style>
