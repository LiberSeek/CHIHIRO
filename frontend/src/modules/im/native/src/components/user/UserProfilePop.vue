<template>
    <Teleport to="body">
        <div class="chihiro-profile-mask" @click="emit('close')" />
        <div
            ref="cardRef"
            v-esc="() => emit('close')"
            class="chihiro-profile-card"
            :style="{
                left: pos.left + 'px',
                top: pos.top + 'px',
                visibility: placed ? 'visible' : 'hidden',
            }"
            @click.stop>
            <div class="chihiro-profile-head">
                <img
                    class="chihiro-profile-avatar"
                    :src="'https://q1.qlogo.cn/g?b=qq&s=0&nk=' + userId"
                    alt="">
                <div class="chihiro-profile-head-main">
                    <div v-if="isFriend" class="chihiro-profile-name-row">
                        <span class="chihiro-profile-name">{{ displayName }}</span>
                        <span class="chihiro-profile-dot" :class="{ online: isOnline }" />
                    </div>
                    <div v-else class="chihiro-profile-name-row">
                        <span class="chihiro-profile-dot" :class="{ online: isOnline }" />
                    </div>
                    <div class="chihiro-profile-qq">QQ {{ userId }}</div>
                </div>
            </div>

            <div v-if="isFriend" class="chihiro-profile-meta">
                <span v-if="sexView" class="chihiro-profile-sex">{{ sexView }}</span>
                <span v-if="sexView" class="chihiro-profile-meta-split">|</span>
                <span>{{ birthdayText }}</span>
            </div>

            <div class="chihiro-profile-rows">
                <div class="chihiro-profile-row">
                    <span class="chihiro-profile-label">{{ $t('等级') }}</span>
                    <span class="chihiro-profile-value chihiro-profile-level">{{ levelText }}</span>
                </div>
                <div class="chihiro-profile-row">
                    <span class="chihiro-profile-label">{{ $t('备注') }}</span>
                    <span class="chihiro-profile-value">{{ remarkText }}</span>
                </div>
                <div v-if="isFriend && inGroup" class="chihiro-profile-row">
                    <span class="chihiro-profile-label">{{ $t('群昵称') }}</span>
                    <span class="chihiro-profile-value">{{ groupCardText }}</span>
                </div>
                <div class="chihiro-profile-row">
                    <span class="chihiro-profile-label">{{ $t('签名') }}</span>
                    <span class="chihiro-profile-value">{{ signText }}</span>
                </div>
                <button type="button" class="chihiro-profile-row is-link" @click="openQzone">
                    <span class="chihiro-profile-label">{{ $t('QQ空间') }}</span>
                    <span class="chihiro-profile-value chihiro-profile-qzone">
                        {{ $t('查看他的QQ空间') }}
                        <font-awesome-icon :icon="['fas', 'angle-right']" />
                    </span>
                </button>
            </div>

            <div class="chihiro-profile-footer">
                <template v-if="isFriend">
                    <button type="button" class="chihiro-profile-btn" @click="shareUser">{{ $t('分享') }}</button>
                    <button type="button" class="chihiro-profile-btn" @click="callUser">{{ $t('音视频通话') }}</button>
                    <button type="button" class="chihiro-profile-btn is-primary" @click="startChat">{{ $t('发消息') }}</button>
                </template>
                <template v-else>
                    <button type="button" class="chihiro-profile-btn" @click="addFriend">{{ $t('加好友') }}</button>
                    <button type="button" class="chihiro-profile-btn is-primary" @click="startChat">{{ $t('发消息') }}</button>
                </template>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Connector } from '@renderer/function/connect'
import { PopInfo, PopType } from '@renderer/function/base'
import { openLink, vEsc } from '@renderer/function/utils/appUtil'
import { copyToClipboard } from '@renderer/function/utils/systemUtil'
import { useAuthStore } from '@renderer/state/auth'
import { useChatStore } from '@renderer/state/chat'
import { useContactStore } from '@renderer/state/contact'
import type { Session } from '@renderer/function/elements/information'
import { i18n } from '@chihiro/im-native/host'

defineOptions({ name: 'UserProfilePop' })

type AnchorRect = {
    top: number
    left: number
    right: number
    bottom: number
    width: number
    height: number
}

const props = defineProps<{
    userId: number
    nickname?: string
    card?: string
    anchor: AnchorRect
}>()

const emit = defineEmits<{
    close: []
}>()

const $t = i18n.global.t
const authStore = useAuthStore()
const chatStore = useChatStore()
const contactStore = useContactStore()
const CARD_W = 360
const CARD_H = 280

function clampPos(width: number, height: number) {
    let left = props.anchor.right + 10
    let top = props.anchor.top - 8
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8
    if (left < 8) left = 8
    if (top + height > window.innerHeight - 8) top = window.innerHeight - height - 8
    if (top < 8) top = 8
    return { left, top }
}

const cardRef = ref<HTMLElement | null>(null)
const pos = ref(clampPos(CARD_W, CARD_H))
const placed = ref(false)
const info = ref<Record<string, any>>({})

const friend = computed(() =>
    contactStore.userList.find((item: any) => item.user_id == props.userId),
)
const member = computed(() =>
    chatStore.chatInfo.info.group_members?.find((item: any) => item.user_id == props.userId),
)
const isFriend = computed(() => !!friend.value)
const inGroup = computed(() => chatStore.chatInfo.show.type === 'group')
const isOnline = computed(() => {
    const status = Number(info.value?.status)
    return status === 10 || status === 1 || status === 11
})
const displayName = computed(() => {
    const remark = String(friend.value?.remark || info.value?.remark || '').trim()
    if (remark) return remark
    return String(
        info.value?.nickname ||
        props.nickname ||
        member.value?.nickname ||
        friend.value?.nickname ||
        '',
    )
})
const remarkText = computed(() => {
    const remark = String(friend.value?.remark || info.value?.remark || '').trim()
    return remark
})
const groupCardText = computed(() => {
    const card = String(member.value?.card || props.card || '').trim()
    return card
})
const signText = computed(() => {
    return String(info.value?.longNick || info.value?.long_nick || '').trim()
})
const sexView = computed(() => {
    const sex = String(info.value?.sex || '').toLowerCase()
    if (sex === 'male' || sex === '男') return '♂ 男'
    if (sex === 'female' || sex === '女') return '♀ 女'
    return ''
})
const birthdayText = computed(() => {
    const month = Number(info.value?.birthday_month)
    const day = Number(info.value?.birthday_day)
    const year = Number(info.value?.birthday_year)
    const parts: string[] = []
    if (month > 0 && day > 0) parts.push(`${month}月${day}日`)
    if (!year) parts.push($t('未填'))
    return parts.join(' ') || $t('未填')
})
const levelText = computed(() => levelToEmoji(info.value?.qqLevel))

function levelToEmoji(level: unknown) {
    let value = Number(level)
    if (!Number.isFinite(value) || value <= 0) return ''
    const crown = Math.floor(value / 64)
    value %= 64
    const sun = Math.floor(value / 16)
    value %= 16
    const moon = Math.floor(value / 4)
    value %= 4
    return '👑'.repeat(crown) + '☀️'.repeat(sun) + '🌙'.repeat(moon) + '⭐️'.repeat(value)
}

function place() {
    const card = cardRef.value
    const width = card?.offsetWidth || CARD_W
    const height = card?.offsetHeight || CARD_H
    pos.value = clampPos(width, height)
    placed.value = true
}

async function load() {
    try {
        const mapped = await Connector.callApi('friend_info', {
            user_id: props.userId,
            no_cache: true,
        })
        const row = Array.isArray(mapped) ? mapped[0] : mapped
        if (row && typeof row === 'object') info.value = row
    } catch {
        info.value = {}
    }
    await nextTick()
    place()
}

function openQzone() {
    openLink('https://user.qzone.qq.com/' + props.userId)
}

async function shareUser() {
    try {
        await copyToClipboard('QQ ' + props.userId)
        new PopInfo().add(PopType.INFO, $t('复制成功'), true)
    } catch {
        new PopInfo().add(PopType.ERR, $t('复制失败'), true)
    }
}

function callUser() {
    new PopInfo().add(PopType.INFO, $t('暂不支持音视频通话'), true)
}

function addFriend() {
    new PopInfo().add(PopType.INFO, $t('暂不支持加好友'), true)
}

function startChat() {
    if (props.userId == authStore.loginInfo.uin) {
        emit('close')
        return
    }
    let chat: Session | undefined = contactStore.userList.find((item) => item.user_id == props.userId)
    if (!chat) {
        chat = {
            user_id: props.userId,
            nickname: displayName.value || $t('临时会话'),
            remark: String(props.userId),
            group_id: inGroup.value ? chatStore.chatInfo.show.id : 0,
            group_name: '',
        }
    }
    contactStore.baseOnMsgList.set(Number(props.userId), chat)
    nextTick(() => {
        const item = document.getElementById('user-' + props.userId)
        if (item) item.click()
        emit('close')
    })
}

watch(() => props.userId, load)
watch(() => props.anchor, () => { pos.value = clampPos(CARD_W, CARD_H); nextTick(place) }, { deep: true })

onMounted(() => {
    place()
    load()
    window.addEventListener('resize', place)
})
onBeforeUnmount(() => {
    window.removeEventListener('resize', place)
})
</script>

<style scoped>
.chihiro-profile-mask {
    position: fixed;
    inset: 0;
    z-index: 4200;
    background: transparent;
}
.chihiro-profile-card {
    position: fixed;
    z-index: 4201;
    width: 360px;
    max-width: calc(100vw - 16px);
    padding: 18px 16px 14px;
    border-radius: 16px;
    background: var(--color-card);
    border: 1px solid rgba(127, 127, 127, 0.22);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.42);
    color: var(--color-font);
    box-sizing: border-box;
}
.chihiro-profile-head {
    display: flex;
    align-items: flex-start;
    gap: 12px;
}
.chihiro-profile-avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    object-fit: cover;
    flex: 0 0 64px;
    background: var(--color-card-1);
}
.chihiro-profile-head-main {
    min-width: 0;
    flex: 1;
    padding-top: 6px;
}
.chihiro-profile-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 22px;
}
.chihiro-profile-name {
    font-size: 16px;
    font-weight: 600;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.chihiro-profile-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid rgba(160, 160, 160, 0.7);
    background: transparent;
    flex: 0 0 8px;
    box-sizing: border-box;
}
.chihiro-profile-dot.online {
    border-color: #34c759;
    background: #34c759;
}
.chihiro-profile-qq {
    margin-top: 6px;
    color: var(--color-font-2);
    font-size: 13px;
}
.chihiro-profile-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 14px 0 4px;
    color: var(--color-font-1);
    font-size: 13px;
}
.chihiro-profile-sex {
    color: #5aa8ff;
}
.chihiro-profile-meta-split {
    opacity: 0.45;
}
.chihiro-profile-rows {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 14px;
}
.chihiro-profile-row {
    display: grid;
    grid-template-columns: 72px 1fr;
    align-items: start;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    width: 100%;
}
.chihiro-profile-row.is-link {
    cursor: pointer;
}
.chihiro-profile-label {
    color: var(--color-font-2);
    font-size: 13px;
    line-height: 1.4;
}
.chihiro-profile-value {
    color: var(--color-font);
    font-size: 13px;
    line-height: 1.4;
    min-height: 1.4em;
    word-break: break-word;
}
.chihiro-profile-level {
    letter-spacing: 1px;
}
.chihiro-profile-qzone {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}
.chihiro-profile-qzone svg {
    width: 12px;
    height: 12px;
    color: var(--color-font-2);
}
.chihiro-profile-footer {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 18px;
}
.chihiro-profile-btn {
    appearance: none;
    flex: 1;
    height: 36px;
    margin: 0;
    padding: 0 10px;
    border-radius: 18px;
    border: 1px solid rgba(160, 160, 160, 0.45);
    background: transparent;
    color: var(--color-font);
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
}
.chihiro-profile-btn.is-primary {
    border-color: transparent;
    background: #0078ff;
    color: #fff;
}
.chihiro-profile-btn:hover {
    background: rgba(127, 127, 127, 0.14);
}
.chihiro-profile-btn.is-primary:hover {
    background: #1b86ff;
}
</style>
