<!--
 * @FileDescription: 联系人 / 消息列表项模板
 * @Author: Stapxs
 * @Date: 2022/08/14
 * @Version: 1.0
-->

<template>
    <div :id="'user-' + (data.user_id ?? data.group_id)"
        :class="'friend-body' + (select ? ' active' : menu ? ' onmenu' : '')"
        :data-name="data.user_id ? data.nickname : data.group_name"
        :data-nickname="data.user_id ? data.nickname : ''"
        :data-type="data.user_id ? 'friend' : 'group'">
        <div :class="data.new_msg === true ? 'new' : ''" />
        <font-awesome-icon v-if="data.user_id == -10000" :icon="['fas', 'bell']" />
        <font-awesome-icon v-else-if="data.user_id == -10001" :icon="['fas', 'user-group']" />
        <img v-else loading="lazy" :title="getShowName(data.group_name || data.nickname, data.remark)"
            :src="data.user_id ? 'https://q1.qlogo.cn/g?b=qq&s=0&nk=' + data.user_id :
                'https://p.qlogo.cn/gh/' + data.group_id + '/' + data.group_id + '/0'">
        <div>
            <div>
                <p>{{ getShowName(data.group_name || data.nickname, data.remark) }}</p>
                <div style="flex: 1" />
                <a class="time">{{ formatSessionTime(data.time) }}</a>
            </div>
            <div>
                <a v-if="data.highlight" class="highlight">
                    {{ data.highlight }}
                </a>
                <a :class="from == 'friend' ? 'nick' : ''">{{
                    from == 'friend' ? (data.longNick ?? '') : data.raw_msg
                }}</a>
                <div v-if="from == 'message'" class="chihiro-session-meta">
                    <font-awesome-icon
                        v-if="data.always_top === true"
                        class="chihiro-pin"
                        :icon="['fas', 'thumbtack']" />
                    <span v-if="unreadCount > 0" class="chihiro-unread">{{ unreadLabel }}</span>
                    <font-awesome-icon
                        v-else-if="muted"
                        class="chihiro-muted"
                        :icon="['fas', 'bell-slash']" />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faBellSlash, faThumbTack } from '@fortawesome/free-solid-svg-icons'
import { formatSessionTime } from '@renderer/function/utils/systemUtil'
import { getShowName, isSessionMuted } from '@renderer/function/utils/msgUtil'

library.add(faBellSlash, faThumbTack)

defineOptions({ name: 'UserFriendBody' })

const props = defineProps<{
    data: any
    select?: boolean
    menu?: boolean
    from?: string
}>()

const unreadCount = computed(() => {
    const n = Number(props.data?.unread)
    if (n > 0) return n
    return props.data?.new_msg ? 1 : 0
})
const unreadLabel = computed(() => unreadCount.value > 99 ? '99+' : String(unreadCount.value))
const muted = computed(() => isSessionMuted(props.data || {}))

</script>


<style>
/* chihiro-moved-from-user-css */
#base-app .friend-body {
    margin: 2px 8px !important;
    padding: 6px 8px !important;
    min-height: 54px;
    align-items: center;
    border-radius: 10px !important;
}
#base-app .friend-body img,
#base-app .friend-body > svg {
    width: 36px !important;
    height: 36px !important;
    border-radius: 50% !important;
    border: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
}
#base-app .friend-body > svg {
    padding: 8px !important;
    background: var(--color-card-2) !important;
}
#base-app .friend-body > div:nth-child(1) {
    display: none !important;
}
#base-app .friend-body > div {
    margin-left: 10px;
    min-width: 0;
}
#base-app .friend-body p {
    font-size: 13px;
    font-weight: 600;
    margin-top: 0 !important;
}
#base-app .friend-body > div > div a {
    font-size: 12px;
    min-width: 0;
}
#base-app .friend-body.active {
    background: var(--color-main) !important;
    color: #fff !important;
}
#base-app .friend-body.active p,
#base-app .friend-body.active a,
#base-app .friend-body.active > div > div a,
#base-app .friend-body.active > a {
    color: #fff !important;
}
#base-app .friend-body.active > svg {
    background: rgba(255, 255, 255, 0.2) !important;
    color: #fff !important;
}
#base-app .friend-body:hover {
    background: rgba(127, 127, 127, 0.16) !important;
}
#base-app .friend-body.active:hover {
    background: var(--color-main) !important;
}
.chihiro-session-meta {
    margin-left: 10px;
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 0 0 auto;
    justify-content: flex-end;
}
#base-app .friend-body .chihiro-session-meta svg {
    width: 12px !important;
    height: 12px !important;
    margin: 0 !important;
    opacity: 0.75;
    flex: none !important;
}
#base-app .friend-body .chihiro-pin {
    transform: rotate(45deg) !important;
    color: var(--color-font-2);
}
#base-app .friend-body .chihiro-muted {
    transform: none !important;
    color: #8e8e93 !important;
}
.chihiro-unread {
    min-width: 16px;
    height: 16px;
    padding: 0 5px;
    box-sizing: border-box;
    border-radius: 999px;
    background: #8e8e93;
    color: #fff !important;
    font-size: 10px;
    font-weight: 600;
    line-height: 16px;
    text-align: center;
    white-space: nowrap;
    flex: none !important;
    overflow: visible !important;
    opacity: 1 !important;
}
#base-app .friend-body.active .chihiro-unread {
    background: rgba(255, 255, 255, 0.42);
    color: #fff !important;
}
#base-app .friend-body.active .chihiro-pin,
#base-app .friend-body.active .chihiro-muted {
    color: rgba(255, 255, 255, 0.85) !important;
}

@media (max-width: 700px) {
    #base-app .friend-body {
        justify-content: flex-start !important;
        margin: 2px 8px !important;
        padding: 6px 8px !important;
        min-height: 54px;
    }
    #base-app .friend-body > div {
        display: block !important;
        flex: 1;
        overflow: hidden;
        margin-left: 10px;
    }
    #base-app .friend-body > div:nth-child(1) {
        display: none !important;
    }
    #base-app .friend-body img,
    #base-app .friend-body > svg {
        width: 36px !important;
        height: 36px !important;
    }
}
</style>
