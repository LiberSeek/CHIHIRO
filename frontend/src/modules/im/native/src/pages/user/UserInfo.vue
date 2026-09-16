<!--
 * @FileDescription: 群 / 好友信息页面
 * @Author: Stapxs
 * @Date: missing
 * @Version: 1.0
-->

<template>
    <div v-esc="onChatInfoEsc"
        class="chat-info-pan">
        <div class="ss-card chat-info">
            <header>
                <button type="button" class="chat-info-back" :aria-label="$t('返回')" :title="$t('返回')" @click="closeChatInfoPan">
                    <font-awesome-icon :icon="['fas', 'angle-left']" />
                </button>
                <span v-if="chat.show.type === 'group'">{{ $t('群资料') }}</span>
                <span v-else>{{ $t('好友') }}</span>
                <button
                    v-if="chat.show.type !== 'group'"
                    type="button"
                    class="chat-info-share"
                    @click="shareUser">{{ $t('分享') }}</button>
            </header>
            <div v-if="chat.show.type === 'group'" :class="'chat-info-base ' + chat.show.type">
                <div class="chat-info-identity">
                    <img :src="chat.show.avatar">
                    <div>
                        <a>{{ chat.show.name }}</a>
                        <span>{{ chat.show.id }}</span>
                    </div>
                    <div class="chat-info-copy" @click="copyText(chat.show.id)">
                        <font-awesome-icon :icon="['fas', 'copy']" />
                    </div>
                </div>
                <div v-show="Object.keys(chat.info.group_info).length > 0">
                    <header>
                        <span>{{ $t('介绍') }}</span>
                    </header>
                    <span v-html=" chat.info.group_info.gIntro === undefined || chat.info.group_info.gIntro === '' ?
                        $t('群主很懒，还没有群介绍哦～') : chat.info.group_info.gIntro" />
                    <div class="tags">
                        <div v-for="item in chat.info.group_info.tags" :key="item.md">
                            {{ item.tag }}
                        </div>
                    </div>
                </div>
            </div>
            <div v-else class="chihiro-friend-profile">
                    <div class="chihiro-fp-hero">
                        <img class="chihiro-fp-avatar" :src="chat.show.avatar" alt="">
                        <div class="chihiro-fp-identity">
                            <div class="chihiro-fp-name">{{ displayName }}</div>
                            <button type="button" class="chihiro-fp-qq" @click="copyText(chat.show.id)">QQ {{ chat.show.id }}</button>
                        </div>
                        <div class="chihiro-fp-aside">
                            <span v-if="isOnline" class="chihiro-fp-online">
                                <i />{{ $t('在线') }}
                            </span>
                        </div>
                    </div>
                    <div v-if="metaParts.length" class="chihiro-fp-meta">
                        <template v-for="(part, index) in metaParts" :key="part.key">
                            <span v-if="index > 0" class="chihiro-fp-meta-split" />
                            <span :class="part.className">{{ part.text }}</span>
                        </template>
                    </div>
                    <div v-if="levelText" class="chihiro-fp-level">{{ levelText }}</div>
                    <div class="chihiro-fp-rows">
                        <div class="chihiro-fp-row">
                            <font-awesome-icon :icon="['fas', 'pen']" />
                            <span class="chihiro-fp-label">{{ $t('备注') }}</span>
                            <span class="chihiro-fp-value" :class="{ 'is-muted': !remarkText }">{{ remarkText || $t('设置好友备注') }}</span>
                        </div>
                        <div class="chihiro-fp-row">
                            <font-awesome-icon :icon="['fas', 'user-group']" />
                            <span class="chihiro-fp-label">{{ $t('好友分组') }}</span>
                            <span class="chihiro-fp-value">{{ categoryText }}</span>
                        </div>
                        <div class="chihiro-fp-row">
                            <font-awesome-icon :icon="['fas', 'signature']" />
                            <span class="chihiro-fp-label">{{ $t('签名') }}</span>
                            <span class="chihiro-fp-value">{{ signText }}</span>
                        </div>
                    </div>
                    <button type="button" class="chihiro-fp-link" @click="openQzone">
                        <font-awesome-icon :icon="['fas', 'star']" />
                        <span class="chihiro-fp-label">{{ $t('QQ空间') }}</span>
                        <font-awesome-icon class="chihiro-fp-chevron" :icon="['fas', 'angle-right']" />
                    </button>
                    <div class="chihiro-fp-actions">
                        <button type="button" class="chihiro-fp-btn" @click="callUser">{{ $t('音视频通话') }}</button>
                        <button type="button" class="chihiro-fp-btn is-primary" @click="startFriendChat">{{ $t('发消息') }}</button>
                    </div>
            </div>
            <BcTab v-if="chat.show.type === 'group'"
                class="chat-info-tab">
                <div :name="$t('成员')">
                    <div class="search-view">
                        <label for="info-member-search" class="sr-only">{{ $t('搜索成员') }}</label>
                        <input id="info-member-search" :placeholder="$t('搜索 ……')" @input="(e: Event) => searchList(e)">
                    </div>
                    <RecycleScroller
                        v-slot="{ item: rawItem }"
                        class="member-scroller"
                        :items="number_cache.length > 0 ? number_cache : chat.info.group_members"
                        :item-size="56"
                        key-field="user_id">
                        <div v-for="item in [asGroupMember(rawItem)]" :key="item.user_id" class="member-item edit">
                            <img alt="nk" loading="lazy"
                                :src="`https://q1.qlogo.cn/g?b=qq&s=0&nk=${item.user_id}`">
                            <div>
                                <a @click="startChat(item)">{{
                                    item.card ? item.card : item.nickname
                                }}</a>
                                <font-awesome-icon v-if="item.role === 'owner'" :icon="['fas', 'crown']" />
                                <font-awesome-icon v-if="item.role === 'admin'" :icon="['fas', 'star']" />
                            </div>
                            <!-- 在手机端戳 id 就能触发 -->
                            <span @click="moreConfig(item)">{{ item.user_id }}</span>
                            <font-awesome-icon v-if="canEditMember(item.role)" :icon="['fas', 'wrench']" @click="moreConfig(item)" />
                            <font-awesome-icon v-else :icon="['fas', 'copy']" @click="copyText(item.user_id)" />
                        </div>
                    </RecycleScroller>
                </div>
                <div :name="$t('公告')">
                    <div class="bulletins">
                        <BulletinBody
                            v-for="(item, index) in chat.info.group_notices ?? []"
                            :key="'bulletins-' + index"
                            :data="item"
                            :index="index" />
                    </div>
                    <div v-if="!chat.info.group_notices || chat.info.group_notices.length === 0"
                        style="text-align: center; padding: 20px; color: var(--color-text-3);">
                        {{ $t('这里还没有公告哦~') }}
                    </div>
                </div>
                <div :name="$t('文件')">
                    <div
                        class="group-files">
                        <div v-for="item in chat.info.group_files"
                            :key="'file-' + (item.folder_id ?? item.file_id)">
                            <FileBody :chat="chat" :item="item" />
                        </div>
                    </div>
                    <div v-if="!chat.info.group_files || chat.info.group_files.length === 0"
                        style="text-align: center; padding: 20px; color: var(--color-text-3);">
                        {{ $t('一点文件都没有耶——') }}
                    </div>
                </div>
                <div :name="$t('设置')">
                    <OptInfo :type="'group'" :chat="chat"
                        @update_mumber_card="updateMumberCard" />
                </div>
            </BcTab>
            <div :class="'ss-card user-config' + (Object.keys(showUserConfig).length > 0 ? ' show' : '')">
                <div>
                    <img alt="nk" :src="`https://q1.qlogo.cn/g?b=qq&s=0&nk=${showUserConfig.user_id}`">
                    <div>
                        <a>{{ showUserConfig.card != '' ? showUserConfig.card : showUserConfig.nickname }}</a>
                        <span>{{ showUserConfig.user_id }}</span>
                    </div>
                    <font-awesome-icon
                        style="margin-right: 20px;"
                        :icon="['fas', 'copy']"
                        @click="copyText(showUserConfig.user_id)" />
                    <font-awesome-icon :icon="['fas', 'angle-down']" @click="showUserConfig = {}" />
                </div>
                <div>
                    <header>{{ $t('成员信息') }}</header>
                    <div class="opt-item">
                        <font-awesome-icon :icon="['fas', 'clipboard-list']" />
                        <div>
                            <label for="info-member-card">{{ $t('成员昵称') }}</label>
                            <span>{{
                                $t('啊吧啊吧……')
                            }}</span>
                        </div>
                        <input id="info-member-card" v-model="showUserConfigRaw.card"
                            style="width: 50%"
                            class="ss-input"
                            type="text"
                            @change="updateMumberCard($event, showUserConfig)">
                    </div>
                    <div v-if="chat.info.me_info.role === 'owner'" class="opt-item">
                        <font-awesome-icon :icon="['fas', 'clipboard-list']" />
                        <div>
                            <label for="info-member-title">{{ $t('成员头衔') }}</label>
                            <span>{{
                                $t('猪咪猪咪')
                            }}</span>
                        </div>
                        <input id="info-member-title" v-model="showUserConfigRaw.title"
                            style="width: 50%"
                            class="ss-input"
                            type="text"
                            @change="updateMumberTitle($event, showUserConfig)">
                    </div>
                    <template v-if="(chat.info.me_info.role === 'owner' && showUserConfig.role != 'owner') || (chat.info.me_info.role === 'admin' && showUserConfig.role === 'member')">
                        <header>{{ $t('操作') }}</header>
                        <div class="opt-item">
                            <font-awesome-icon :icon="['fas', 'clipboard-list']" />
                            <div>
                                <label for="info-member-ban-min">{{ $t('禁言成员') }}</label>
                                <span>{{
                                    $t('要让小猫咪不许说话几分钟呢？')
                                }}</span>
                            </div>
                            <input id="info-member-ban-min" v-model="mumberInfo.banMin"
                                style="width: 50%"
                                class="ss-input"
                                type="text"
                                @input="checkNumber"
                                @change="banMumber($event, showUserConfig)">
                        </div>
                        <button class="ss-button"
                            @click="removeUser(showUserConfig.nickname, chat.show.id, showUserConfig.user_id)">
                            {{ $t('移出群聊') }}
                        </button>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import app, { i18n } from '@chihiro/im-native/host'
import BulletinBody from '@renderer/components/user/UserBulletinBody.vue'
import FileBody from '@renderer/components/user/UserFileBody.vue'
import OptInfo from '@renderer/pages/user/UserOptInfo.vue'
import BcTab from 'vue3-bcui/packages/bc-tab'
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

import { Connector } from '@renderer/function/connect'
import { PopInfo, PopType } from '@renderer/function/base'
import { computed, toRaw, ref, nextTick } from 'vue'
import { delay } from '@renderer/function/utils/systemUtil'
import { openLink, vEsc } from '@renderer/function/utils/appUtil'
import { useAuthStore } from '@renderer/state/auth'
import { useContactStore } from '@renderer/state/contact'
import { useChatStore } from '@renderer/state/chat'
import { useUIStore } from '@renderer/state/ui'
import {
    GroupMemberInfoElem,
    UserFriendElem,
    UserGroupElem,
} from '@renderer/function/elements/information'
import { qqLevelToEmoji } from '@renderer/function/utils/msgUtil'

defineOptions({ name: 'UserInfo' })

const authStore = useAuthStore()
const contactStore = useContactStore()
const chatStore = useChatStore()
const uiStore = useUIStore()

const props = defineProps<{
    tags: any
    chat: any
}>()

const emit = defineEmits<{
    close: []
    startChat: []
}>()

const { t: $t } = i18n.global

// Reactive state
const number_cache = ref<any[]>([])
const showUserConfig = ref<any>({})
const showUserConfigRaw = ref<any>({})
const mumberInfo = ref({
    banMin: 0,
})

function asGroupMember(item: unknown): GroupMemberInfoElem {
    return item as GroupMemberInfoElem
}

const friend = computed(() =>
    contactStore.userList.find((item: UserFriendElem & UserGroupElem) => item.user_id == props.chat.show.id),
)
const userInfo = computed(() => (props.chat.info?.user_info ?? {}) as Record<string, any>)
const displayName = computed(() => {
    const remark = String(friend.value?.remark || userInfo.value.remark || '').trim()
    if (remark && remark !== String(props.chat.show.id)) return remark
    return String(props.chat.show.name || userInfo.value.nickname || props.chat.show.id)
})
const remarkText = computed(() => {
    const remark = String(friend.value?.remark || userInfo.value.remark || '').trim()
    if (!remark || remark === String(props.chat.show.name) || remark === String(props.chat.show.id)) return ''
    return remark
})
const categoryText = computed(() => String(friend.value?.class_name || '').trim() || $t('我的好友'))
const signText = computed(() =>
    String(userInfo.value.longNick || userInfo.value.long_nick || '').trim() || $t('这个人很懒什么都没有写～'),
)
const isOnline = computed(() => {
    const status = Number(userInfo.value.status)
    return status === 10 || status === 1 || status === 11
})
const levelText = computed(() => {
    const raw = qqLevelToEmoji(Number(userInfo.value.qqLevel) || 0)
    if (typeof raw !== 'string') return ''
    return raw.replace(/（\d+）$/, '')
})
const metaParts = computed(() => {
    const info = userInfo.value
    const parts: { key: string, text: string, className?: string }[] = []
    const sex = String(info.sex || '').toLowerCase()
    if (sex === 'male' || sex === '男') parts.push({ key: 'sex', text: '♂ 男', className: 'is-male' })
    else if (sex === 'female' || sex === '女') parts.push({ key: 'sex', text: '♀ 女', className: 'is-female' })
    const age = Number(info.age)
    if (age > 0) parts.push({ key: 'age', text: `${age}${$t('岁')}` })
    const month = Number(info.birthday_month)
    const day = Number(info.birthday_day)
    if (month > 0 && day > 0) {
        const zodiac = zodiacFromDate(month, day)
        parts.push({ key: 'birth', text: zodiac ? `${month}月${day}日 ${zodiac}` : `${month}月${day}日` })
    }
    const place = [info.city, info.province, info.country].map((item) => String(item || '').trim()).filter(Boolean)
    if (place.length) parts.push({ key: 'place', text: `${$t('现居')} ${place[0]}` })
    return parts
})

function zodiacFromDate(month: number, day: number) {
    const table: [number, number, string][] = [
        [1, 20, '水瓶座'], [2, 19, '双鱼座'], [3, 21, '白羊座'], [4, 20, '金牛座'],
        [5, 21, '双子座'], [6, 22, '巨蟹座'], [7, 23, '狮子座'], [8, 23, '处女座'],
        [9, 23, '天秤座'], [10, 24, '天蝎座'], [11, 23, '射手座'], [12, 22, '摩羯座'],
    ]
    for (let i = 0; i < table.length; i++) {
        const [m, d, name] = table[i]
        const prev = table[i === 0 ? table.length - 1 : i - 1]
        if (month === m && day < d) return prev[2]
        if (month === m) return name
    }
    return ''
}

function openQzone() {
    openLink('https://user.qzone.qq.com/' + props.chat.show.id)
}

function shareUser() {
    copyText('QQ ' + props.chat.show.id)
}

function callUser() {
    new PopInfo().add(PopType.INFO, $t('暂不支持音视频通话'), true)
}

function startFriendChat() {
    emit('startChat')
}

/**
 * 移出群聊
 */
function removeUser(nickname: string, group_id: number, user_id: number) {
    const popInfo = {
        title: $t('提醒'),
        html: `<span>${$t('真的要将 {user} 移出群聊吗', { user: nickname })}</span>`,
        button: [
            {
                text: $t('确定'),
                fun: () => {
                    Connector.send(
                        'set_group_kick',
                        {
                            group_id: group_id,
                            user_id: user_id,
                        },
                        'setGroupKick',
                    )
                    uiStore.popBoxList.shift()
                    showUserConfig.value = {}
                    const popInfo = {
                        title: $t('操作'),
                        html: `<span>${$t('正在确认操作……')}</span>`
                    }
                    uiStore.popBoxList.push(popInfo)
                    // 稍微等一下再刷新成员列表
                    delay(1000).then(() => {
                        Connector.send(
                            'get_group_member_list',
                            { group_id: chatStore.chatInfo.show.id, no_cache: true },
                            'getGroupMemberList',
                        )
                        return delay(1000)
                    }).then(() => {
                        Connector.send(
                            'get_group_member_list',
                            { group_id: chatStore.chatInfo.show.id, no_cache: true },
                            'getGroupMemberList',
                        )
                        uiStore.popBoxList.shift()
                    })
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

function copyText(text: any) {
    const popInfo = new PopInfo()
    app.config.globalProperties.$copyText(String(text)).then(
        () => {
            popInfo.add(PopType.INFO, $t('复制成功'), true)
        },
        () => {
            popInfo.add(PopType.ERR, $t('复制失败'), true)
        },
    )
}

function banMumber(event: Event, info: any) {
    const value = (event.target as HTMLInputElement).value
    if (value !== '') {
        const num = parseInt(value)
        if (num > 0) {
            const popInfo = {
                title: $t('操作'),
                html: `<span>${$t('确认禁言？')}</span>`,
                button: [
                    {
                        text: $t('确认'),
                        fun: () => {
                            const name = authStore.jsonMap.ban_mumber?.name
                            if (name)
                                Connector.send(name, {
                                    group_id: chatStore.chatInfo.show.id,
                                    user_id: info.user_id,
                                    duration: num * 60,
                                }, 'banMumber')
                            uiStore.popBoxList.shift()
                            closeChatInfoPan()
                        },
                    },
                    {
                        text: $t('取消'),
                        master: true,
                        fun: () => {
                            showUserConfigRaw.value = JSON.parse(JSON.stringify(info))
                            uiStore.popBoxList.shift()
                        },
                    },
                ],
            }
            uiStore.popBoxList.push(popInfo)
        }
    }
}

function updateMumberCard(event: Event, info: any) {
    const value = (event.target as HTMLInputElement).value
    if (showUserConfig.value.card !== value) {
        const popInfo = {
            title: $t('操作'),
            html: `<span>${$t('确认修改昵称？')}</span>`,
            button: [
                {
                    text: $t('确认'),
                    fun: () => {
                        const name = authStore.jsonMap.set_group_nickname?.name
                        if(name)
                            Connector.send(name, {
                                group_id: chatStore.chatInfo.show.id,
                                user_id: info.user_id,
                                card: value,
                            }, 'updateGroupMemberInfo')
                        uiStore.popBoxList.shift()
                        closeChatInfoPan()
                    },
                },
                {
                    text: $t('取消'),
                    master: true,
                    fun: () => {
                        showUserConfigRaw.value = JSON.parse(JSON.stringify(info))
                        uiStore.popBoxList.shift()
                    },
                },
            ],
        }
        uiStore.popBoxList.push(popInfo)
    }
}

function updateMumberTitle(event: Event, info: any) {
    const value = (event.target as HTMLInputElement).value
    if (showUserConfig.value.card !== value) {
        const popInfo = {
            title: $t('操作'),
            html: `<span>${$t('确认修改头衔？')}</span>`,
            button: [
                {
                    text: $t('确认'),
                    fun: () => {
                        const name = authStore.jsonMap.set_group_title?.name
                        if(name)
                            Connector.send(name, {
                                group_id: chatStore.chatInfo.show.id,
                                user_id: info.user_id,
                                special_title: value,
                            }, 'updateGroupMemberInfo')
                        uiStore.popBoxList.shift()
                        closeChatInfoPan()
                    },
                },
                {
                    text: $t('取消'),
                    master: true,
                    fun: () => {
                        showUserConfigRaw.value = JSON.parse(JSON.stringify(info))
                        uiStore.popBoxList.shift()
                    },
                },
            ],
        }
        uiStore.popBoxList.push(popInfo)
    }
}

function getBanTimeMin(endTime: number) {
    // endTime 可能是精确到秒的时间戳
    if(endTime < 10000000000) {
        endTime *= 1000
    }
    const now = new Date().getTime()
    const time = endTime - now
    if (time > 0) {
        return Math.floor(time / 1000 / 60)
    } else {
        return 0
    }
}

function checkNumber(event: Event) {
    const value = (event.target as HTMLInputElement).value
    if (value !== '') {
        const num = parseInt(value)
        if (isNaN(num)) {
            (event.target as HTMLInputElement).value = ''
        } else if (num < 0) {
            (event.target as HTMLInputElement).value = '0'
        }
    }
}

/**
 * 关闭面板
 */
function closeChatInfoPan() {
    showUserConfig.value = {}
    emit('close')
}

function onChatInfoEsc() {
    if (Object.keys(showUserConfig.value).length > 0) {
        showUserConfig.value = {}
        return
    }
    closeChatInfoPan()
}

/**
 * 发起聊天
 */
function startChat(info: any) {
    // 如果是自己的话就忽略
    if (info.user_id != authStore.loginInfo.uin) {

        // 检查这个人是不是好友
        let chat = contactStore.userList.find(
            (item: UserFriendElem & UserGroupElem) => {
                return item.user_id == info.user_id
            },
        )
        if (!chat) {
            // 创建一个临时聊天
            const user = {
                user_id: info.user_id,
                // 因为临时消息没有返回昵称
                nickname:
                    $t('临时会话'),
                remark: info.user_id,
                group_id: info.group_id,
                group_name: '',
            } as UserFriendElem & UserGroupElem
            chat = user
        }
        contactStore.baseOnMsgList.set(Number(info.user_id), chat)
        // 切换到这个聊天
        nextTick(() => {
            if (chat) {
                const item = document.getElementById(
                    'user-' + chat.user_id,
                )
                if (item) {
                    item.click()
                }
            }
        })
    }
}

function moreConfig(info: any) {
    if(canEditMember(info.role)) {
        showUserConfig.value = info
        showUserConfigRaw.value = JSON.parse(JSON.stringify(info))
        // 初始化一些内容
        mumberInfo.value.banMin = getBanTimeMin(info.shut_up_timestamp)
    } else {
        copyText(info.user_id)
    }
}

function searchList(event: Event) {
    const value = (event.target as HTMLInputElement).value
    if (value !== '') {
        number_cache.value = toRaw(props.chat.info.group_members)
        number_cache.value = number_cache.value.filter((item: any) => {
            const name =
                item.card.toLowerCase() +
                '(' +
                item.nickname.toLowerCase() +
                ')'
            const id = item.user_id
            return (
                name.indexOf(value.toLowerCase()) != -1 ||
                id.toString() === value
            )
        })
    } else {
        number_cache.value = [] as any[]
    }
}

function canEditMember(role: string) {
    return (
        props.chat.info.me_info.role === 'owner' ||
        (props.chat.info.me_info.role === 'admin'
         && role !== 'owner') // 管理员不能编辑群主
    )
}
</script>

<style scoped>
    .search-view {
        background: transparent !important;
        padding: 8px 16px 6px;
        margin-bottom: 4px;
    }
    .search-view > input {
        background: rgba(127, 127, 127, 0.12);
        border-radius: 18px;
        padding: 0 14px;
        height: 36px;
        width: 100%;
        border: 1px solid transparent;
        box-sizing: border-box;
        font-size: 13px;
        color: var(--color-font);
        outline: none;
    }
    .search-view > input:focus {
        border-color: rgba(0, 122, 255, 0.45);
        background: var(--color-card-1);
    }

    div[name="成员"] {
        overflow: hidden;
    }
    /* 虚拟滚动容器样式 */
    .member-scroller {
        flex: 1;
        height: calc(100vh - 330px);
        min-height: 210px;
    }

    /* 成员项样式 */
    .member-item {
        transition: background 0.2s;
        margin: 0 8px 2px;
        align-items: center;
        border-radius: 10px;
        cursor: pointer;
        display: flex;
        padding: 8px 10px;
        min-height: 52px;
        box-sizing: border-box;
    }

    .member-item:hover {
        background: rgba(127, 127, 127, 0.12);
    }

    .member-item > img {
        border-radius: 50%;
        margin-right: 10px;
        height: 36px;
        width: 36px;
    }

    .member-item > div {
        overflow: hidden;
        align-items: center;
        display: flex;
        flex: 1;
    }

    .member-item > div > a {
        color: var(--color-font);
        white-space: nowrap;
        text-overflow: ellipsis;
        max-width: 80%;
        overflow: hidden;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
    }

    .member-item > div > svg {
        color: var(--color-main);
        margin-left: 5px;
        height: 0.8rem;
    }

    .member-item > span {
        color: var(--color-font-2);
        transition: all .2s;
        opacity: 1;
        font-size: 12px;
    }

    .member-item.edit:hover > span {
        transform: translateX(-10px);
        opacity: 0;
    }

    .member-item > svg {
        color: var(--color-font-2);
        transition: all .2s;
        margin-right: -25px;
        margin-left: 10px;
        width: 15px;
        opacity: 0;
    }

    .member-item > svg:hover {
        color: var(--color-main);
    }

    .member-item.edit:hover > svg {
        margin-right: 5px;
        display: block;
        opacity: 1;
    }
</style>
<style>
    .tab-body {
        overflow: hidden !important;
        flex-direction: column;
        display: flex;
    }
    .tab-body > div {
        overflow: scroll;
        flex: 1;
    }
</style>

<style>
/* chihiro-moved-from-user-css */
.chat-info-pan {
    background: rgba(0, 0, 0, 0.38);
    z-index: 40;
}
.chat-info-float-enter-active,
.chat-info-float-leave-active {
    transition: opacity 0.2s ease !important;
}
.chat-info-float-enter-active .chat-info,
.chat-info-float-leave-active .chat-info {
    animation: none !important;
    transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1) !important;
}
.chat-info-float-enter-from,
.chat-info-float-leave-to {
    opacity: 0;
}
.chat-info-float-enter-from .chat-info,
.chat-info-float-leave-to .chat-info {
    opacity: 1;
    transform: translate(-50%, -50%) scale(0.96) !important;
}
.chat-info.ss-card,
.chat-info {
    width: min(420px, calc(100% - 48px)) !important;
    min-width: 0 !important;
    max-height: min(80%, 640px) !important;
    padding: 0 !important;
    border-radius: 16px !important;
    background: var(--color-card) !important;
    border: 1px solid rgba(127, 127, 127, 0.14);
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.32) !important;
    overflow: hidden;
}
.chat-info.ss-card:hover,
.chat-info:hover {
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.32) !important;
}
.chat-info > header {
    height: 52px;
    min-height: 52px;
    box-sizing: border-box;
    margin: 0 !important;
    padding: 0 16px 0 8px !important;
    display: flex;
    justify-content: flex-start;
    align-items: center;
    gap: 4px;
    border-bottom: 1px solid rgba(127, 127, 127, 0.12);
    letter-spacing: 0 !important;
    font-weight: 650;
}
.chat-info > header > span {
    flex: 0 1 auto !important;
    font-size: 15px !important;
    font-weight: 650;
    letter-spacing: 0;
}
.chat-info-back {
    display: grid;
    flex: 0 0 36px;
    width: 36px;
    height: 36px;
    place-items: center;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 8px;
    color: var(--color-font);
    background: transparent;
    cursor: pointer;
}
.chat-info-back svg {
    width: 16px !important;
    height: 16px !important;
    padding: 0 !important;
    margin: 0 !important;
}
.chat-info-back:hover {
    background: rgba(127, 127, 127, 0.12);
}
.chat-info-share {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
    height: 36px;
    padding: 0 12px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--color-font);
    font-size: 14px;
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
    flex: 0 0 auto;
}
.chat-info-share:hover {
    background: rgba(127, 127, 127, 0.12);
}
.chat-info-base {
    background: transparent !important;
    margin: 0 !important;
    padding: 16px 16px 8px !important;
    border-radius: 0 !important;
}
.chat-info-identity,
.chat-info-base.group > div.chat-info-identity {
    background: transparent !important;
    border-radius: 0 !important;
    width: auto !important;
    margin: 0 0 8px !important;
    padding: 0 !important;
    gap: 12px;
    display: flex;
    align-items: center;
}
.chat-info-identity > img {
    width: 48px !important;
    height: 48px !important;
    margin: 0 !important;
    border: 0 !important;
    outline: none !important;
    border-radius: 50% !important;
}
.chat-info-identity > div:nth-child(2) {
    margin-left: 0 !important;
}
.chat-info-identity > div:nth-child(2) > a {
    font-size: 16px !important;
    font-weight: 650;
    line-height: 1.3;
}
.chat-info-identity > div:nth-child(2) > span {
    font-size: 12px !important;
    color: var(--color-font-2) !important;
    margin-top: 2px;
}
.chat-info-copy {
    width: 32px !important;
    height: 32px !important;
    padding: 0 !important;
    background: rgba(127, 127, 127, 0.12) !important;
    border-radius: 50% !important;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}
.chat-info-copy > svg {
    width: 13px;
    height: 13px;
}
.chat-info-base > div:last-child {
    padding: 4px 0 0 !important;
}
.chat-info-base > div:last-child > header {
    color: var(--color-font-2) !important;
    font-size: 11px !important;
    font-weight: 600;
    letter-spacing: 0.04em;
    margin-top: 12px !important;
    padding-bottom: 4px !important;
}
.chat-info-base > div:last-child > span {
    font-size: 13px;
    line-height: 1.5;
    color: var(--color-font);
}
.chat-info-base > div:last-child > div.tags {
    margin-top: 8px !important;
    gap: 6px;
}
.chat-info-base > div:last-child > div.tags > div {
    margin: 0 !important;
    padding: 3px 10px !important;
    border-radius: 999px !important;
    font-size: 12px !important;
}
.chat-info-base > div:last-child > div.outher > span {
    font-size: 13px;
    margin: 4px 0;
}
.chat-info-tab {
    margin-top: 4px !important;
}
.chat-info-tab > div:first-child,
.chat-info-tab > div:first-child:hover {
    min-height: 40px;
    background: transparent !important;
    border: 0 !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
}
.chat-info-tab .tab-bar {
    --bc-tab-margin: 0px;
    padding: 0 16px !important;
    margin: 0 !important;
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
}
.chat-info-tab .tab-bar > li span {
    font-size: 13px !important;
    font-weight: 600;
}
.chat-info .search-view > input {
    height: 36px !important;
    border: 1px solid transparent !important;
    border-bottom: 1px solid transparent !important;
    border-radius: 18px !important;
    font-size: 13px !important;
}
.chat-info .ss-input {
    height: 32px;
    border-radius: 10px;
    font-size: 13px;
    background: rgba(127, 127, 127, 0.12);
}
.chat-info .ss-input:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.35);
}
.chat-info .ss-button {
    height: 36px;
    border-radius: 10px;
    font-size: 13px;
}
.chat-info .info-pan-set {
    padding: 8px 16px 16px;
}
.chat-info .info-pan-set .opt-group-card {
    background: var(--color-card-1);
}
.chat-info .info-pan-set .ss-input {
    width: min(220px, 52%);
    min-width: 132px;
    height: 32px;
    padding: 0 14px;
    border: 0;
    border-radius: 999px;
    background: rgba(127, 127, 127, 0.16);
    box-shadow: none;
    font-size: 0.82rem;
    line-height: 32px;
}
.chat-info .info-pan-set .ss-input:focus {
    box-shadow: none;
    background: rgba(127, 127, 127, 0.22);
}
.chat-info .info-pan-set .ss-button.info-leave-btn {
    width: 100%;
    height: 36px;
    margin: 0;
    border-radius: 999px;
    background: rgba(255, 69, 58, 0.12);
    color: #ff453a;
    font-size: 0.86rem;
    font-weight: 600;
}
@media (max-width: 680px) {
    .chat-info .info-pan-set .opt-item {
        flex-wrap: wrap;
    }
    .chat-info .info-pan-set .ss-input {
        width: 100%;
        min-width: 0;
    }
}
.user-config {
    width: 100% !important;
    margin-left: 0 !important;
    margin-top: 48px !important;
    border-radius: 16px 16px 0 0 !important;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.18) !important;
}
.user-config > div:first-child {
    background: transparent !important;
    border-radius: 0 !important;
    padding: 16px !important;
    margin: 0 !important;
    border-bottom: 1px solid rgba(127, 127, 127, 0.12);
}
.user-config > div:first-child > img {
    width: 36px !important;
    height: 36px !important;
    border: 0 !important;
    outline: none !important;
    border-radius: 50% !important;
}
.user-config > div:last-child {
    padding: 8px 16px 20px !important;
    margin-top: 0 !important;
}
.user-config button {
    width: calc(100% - 32px) !important;
    margin: 16px !important;
    height: 36px;
    border-radius: 10px;
}
.bulletins {
    padding: 8px 12px !important;
}
.bulletins > div {
    border-radius: 10px !important;
    padding: 10px 12px !important;
}
.group-files {
    padding: 8px 12px;
}

.chihiro-friend-profile {
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
    box-sizing: border-box;
    width: 100%;
    padding: 12px 36px 24px;
    color: var(--color-font);
}
.chihiro-fp-hero {
    display: flex;
    align-items: center;
    gap: 18px;
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(127, 127, 127, 0.14);
}
.chihiro-fp-avatar {
    width: 88px;
    height: 88px;
    flex: 0 0 88px;
    border-radius: 50%;
    object-fit: cover;
    background: var(--color-card-1);
}
.chihiro-fp-identity {
    min-width: 0;
    flex: 1;
}
.chihiro-fp-name {
    font-size: 22px;
    font-weight: 650;
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.chihiro-fp-qq {
    margin: 6px 0 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-font-2);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
}
.chihiro-fp-aside {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 0 0 auto;
    margin-left: auto;
}
.chihiro-fp-online {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-font);
    font-size: 13px;
}
.chihiro-fp-online > i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #30d158;
}
.chihiro-fp-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 16px 0 8px;
    color: var(--color-font-1);
    font-size: 13px;
}
.chihiro-fp-meta-split {
    width: 1px;
    height: 12px;
    background: rgba(127, 127, 127, 0.28);
}
.chihiro-fp-meta .is-male { color: #6cb6ff; }
.chihiro-fp-meta .is-female { color: #ff8fab; }
.chihiro-fp-level {
    margin: 10px 0 4px;
    font-size: 16px;
    letter-spacing: 2px;
}
.chihiro-fp-rows {
    display: flex;
    flex-direction: column;
    margin-top: 6px;
}
.chihiro-fp-row,
.chihiro-fp-link {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
}
.chihiro-fp-row > svg,
.chihiro-fp-link > svg:first-child {
    width: 14px;
    height: 14px;
    color: var(--color-font-2);
    flex: 0 0 14px;
}
.chihiro-fp-label {
    flex: 0 0 auto;
    color: var(--color-font-1);
    font-size: 14px;
}
.chihiro-fp-value {
    min-width: 0;
    margin-left: auto;
    color: var(--color-font);
    font-size: 14px;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.chihiro-fp-value.is-muted {
    color: var(--color-font-2);
}
.chihiro-fp-link {
    width: 100%;
    margin-top: 8px;
    padding-top: 10px;
    border-top: 1px solid rgba(127, 127, 127, 0.14);
    cursor: pointer;
}
.chihiro-fp-chevron {
    margin-left: auto;
    width: 12px !important;
    height: 12px !important;
    color: var(--color-font-2);
}
.chihiro-fp-actions {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: auto;
    padding-top: 36px;
}
.chihiro-fp-btn {
    min-width: 108px;
    height: 36px;
    padding: 0 18px;
    border: 1px solid rgba(127, 127, 127, 0.28);
    border-radius: 10px;
    background: transparent;
    color: var(--color-font);
    cursor: pointer;
    font-size: 14px;
}
.chihiro-fp-btn:hover {
    background: rgba(127, 127, 127, 0.1);
}
.chihiro-fp-btn.is-primary {
    border-color: transparent;
    background: var(--color-main);
    color: var(--color-font-r, #fff);
}
.chihiro-fp-btn.is-primary:hover {
    filter: brightness(1.06);
}

@media (max-width: 700px) {
    .chat-info.ss-card,
    .chat-info {
        width: calc(100% - 32px) !important;
        max-width: 420px !important;
        min-width: 0 !important;
        height: auto !important;
        max-height: 80% !important;
        margin: 50vh 0 0 50% !important;
        bottom: auto !important;
        transform: translate(-50%, -50%) !important;
        border-radius: 16px !important;
    }
    .chat-info-pan {
        height: 100% !important;
    }
    .chat-info-float-enter-from .chat-info,
    .chat-info-float-leave-to .chat-info {
        transform: translate(-50%, -50%) scale(0.96) !important;
    }
}
</style>
