<!--
 * @FileDescription: 设置页面（功能子页面）
 * @Author: Stapxs
 * @Date: 2022/11/07
 * @Version: 1.0
-->
<!-- eslint-disable max-len -->

<template>
    <div class="opt-page">
        <div class="opt-group">
            <header class="opt-group-title">{{ $t('会话') }}</header>
            <div class="opt-group-card">
            <div class="opt-item">
                <div />
                <div>
                    <label for="opt-chihiro-bot-new-default">{{ $t('新会话默认开启 Bot') }}</label>
                    <span>{{ $t('仅对尚未单独设置过的会话生效') }}</span>
                </div>
                <label class="ss-switch">
                    <input id="opt-chihiro-bot-new-default" v-model="chihiroBotNewDefault"
                        type="checkbox" @change="saveChihiroBotDefault">
                    <div>
                        <div />
                    </div>
                </label>
            </div>
            <div class="opt-item">
                <div :class="checkDefault('bubble_sort_user')" />
                <div>
                    <label for="opt-function-bubble-sort-user">{{ $t('展开群助手') }}</label>
                    <span>{{ $t('在会话列表中展开群助手内的会话') }}</span>
                </div>
                <label class="ss-switch">
                    <input id="opt-function-bubble-sort-user" v-model="settingsStore.sysConfig.bubble_sort_user"
                        type="checkbox" name="bubble_sort_user" @change="save">
                    <div>
                        <div />
                    </div>
                </label>
            </div>
            <div class="opt-item">
                <div :class="checkDefault('session_display_mode')" />
                <div>
                    <label for="opt-function-session-display-mode">{{ $t('显示全部会话') }}</label>
                    <span>{{ $t('关闭后仅保留最近会话') }}</span>
                </div>
                <label class="ss-switch">
                    <input id="opt-function-session-display-mode" :checked="settingsStore.sysConfig.session_display_mode === 'all'"
                        type="checkbox" name="session_display_mode" @change="toggleSessionDisplay">
                    <div>
                        <div />
                    </div>
                </label>
            </div>
            </div>
        </div>
        <div class="opt-group">
            <header class="opt-group-title">{{ $t('通知') }}</header>
            <div class="opt-group-card">
            <div class="opt-item">
                <div :class="checkDefault('close_notice')" />
                <div>
                    <label for="opt-function-close-notice">{{ $t('停用通知') }}</label>
                    <span>{{ $t('开启后不再推送新消息提醒') }}</span>
                </div>
                <label class="ss-switch">
                    <input id="opt-function-close-notice" v-model="settingsStore.sysConfig.close_notice"
                        type="checkbox" name="close_notice" @change="save">
                    <div>
                        <div />
                    </div>
                </label>
            </div>
            <div class="opt-item">
                <div :class="checkDefault('group_notice_type')" />
                <div>
                    <label for="opt-function-group-notice-type">{{ $t('群消息通知') }}</label>
                    <span>{{ $t('重要消息仍会发送应用内和系统通知') }}</span>
                </div>
                <div class="select-wrapper">
                    <select id="opt-function-group-notice-type"
                        v-model="settingsStore.sysConfig.group_notice_type"
                        name="group_notice_type" title="group_notice_type" @change="save">
                        <option value="none">
                            {{ $t('不通知') }}
                        </option>
                        <option value="inner">
                            {{ $t('仅应用内通知') }}
                        </option>
                        <option value="all">
                            {{ $t('应用内通知和系统通知') }}
                        </option>
                    </select>
                </div>
            </div>
            </div>
        </div>
        <div class="opt-group">
            <header class="opt-group-title">{{ $t('聊天') }}</header>
            <div class="opt-group-card">
            <div class="opt-item">
                <div>
                    <label for="opt-function-msg-nd">{{ $t('消息防撤回') }}</label>
                    <span>{{ $t('该功能暂未提供') }}</span>
                </div>
                <label
                    v-if="ndt < 3"
                    class="ss-switch">
                    <input id="opt-function-msg-nd" v-model="ndv" type="checkbox"
                        @change="msgND">
                    <div>
                        <div />
                    </div>
                </label>
            </div>
            <div class="opt-item">
                <div :class="checkDefault('msg_taill')" />
                <div>
                    <label for="opt-function-msg-tail">{{ $t('消息后缀') }}</label>
                    <span>{{ $t('发送时追加在消息末尾') }}</span>
                </div>
                <input id="opt-function-msg-tail" v-model="settingsStore.sysConfig.msg_taill"
                    class="ss-input" style="width: 150px"
                    type="text" name="msg_taill" @keyup="save">
            </div>
            <div class="opt-item">
                <div :class="checkDefault('send_face')" />
                <div>
                    <label for="opt-function-send-face">{{ $t('点击表情直接发送') }}</label>
                    <span>{{ $t('无需确认，点击后立即发送') }}</span>
                </div>
                <label class="ss-switch">
                    <input id="opt-function-send-face" v-model="settingsStore.sysConfig.send_face"
                        type="checkbox" name="send_face" @change="save">
                    <div>
                        <div />
                    </div>
                </label>
            </div>
            <div class="opt-item">
                <div :class="checkDefault('opt_no_auto_load_image')" />
                <div>
                    <label for="opt-function-no-auto-load-image">{{ $t('手动加载图片') }}</label>
                    <span>{{ $t('图片先显示占位，点击后再加载') }}</span>
                </div>
                <label class="ss-switch">
                    <input id="opt-function-no-auto-load-image" v-model="settingsStore.sysConfig.opt_no_auto_load_image"
                        type="checkbox" name="opt_no_auto_load_image" @change="save">
                    <div>
                        <div />
                    </div>
                </label>
            </div>
            <div class="opt-item">
                <div :class="checkDefault('use_breakline')" />
                <div>
                    <label for="opt-function-use-breakline">{{ $t('多行输入') }}</label>
                    <span>{{ $t('允许在输入框中换行') }}</span>
                </div>
                <label class="ss-switch">
                    <input id="opt-function-use-breakline" v-model="settingsStore.sysConfig.use_breakline" type="checkbox"
                        name="use_breakline" @change="breakLineTip($event);save($event)">
                    <div>
                        <div />
                    </div>
                </label>
            </div>
            <div v-if="settingsStore.sysConfig.use_breakline" class="opt-item">
                <div :class="checkDefault('send_key')" />
                <div>
                    <label for="opt-function-send-key">{{ $t('发送快捷键') }}</label>
                    <span>{{ $t('未选中的组合键可用于换行') }}</span>
                </div>
                <div class="select-wrapper">
                    <select v-if="backend.platform === 'darwin' || backend.platform === 'ios'" id="opt-function-send-key" v-model="settingsStore.sysConfig.send_key"
                        name="send_key" title="send_key" @change="save">
                        <option value="none">
                            Enter
                        </option>
                        <option value="shift">
                            Shift + Enter (⇧)
                        </option>
                        <option value="ctrl">
                            Control + Enter (⌃)
                        </option>
                        <option value="alt">
                            Option + Enter (⌥)
                        </option>
                        <option value="meta">
                            Command + Enter (⌘)
                        </option>
                    </select>
                    <select v-else id="opt-function-send-key" v-model="settingsStore.sysConfig.send_key"
                        name="send_key" title="send_key" @change="save">
                        <option value="none">
                            Enter
                        </option>
                        <option value="shift">
                            Shift + Enter
                        </option>
                        <option value="ctrl">
                            Ctrl + Enter
                        </option>
                        <option value="alt">
                            Alt + Enter
                        </option>
                        <option value="meta">
                            Meta + Enter
                        </option>
                    </select>
                </div>
            </div>
            <div class="opt-item">
                <div :class="checkDefault('record_recent_emoji')" />
                <div>
                    <label for="opt-function-recent-emoji">{{ $t('最近使用的表情') }}</label>
                    <span>{{ $t('按使用情况记录常用表情') }}</span>
                </div>
                <div class="select-wrapper">
                    <select
                        id="opt-function-recent-emoji"
                        v-model="settingsStore.sysConfig.record_recent_emoji"
                        name="record_recent_emoji"
                        title="record_recent_emoji">
                        <option value="none">
                            {{ $t('不记录') }}
                        </option>
                        <option value="order">
                            {{ $t('使用顺序') }}
                        </option>
                        <option value="100times">
                            {{ $t('按 100 次使用频率') }}
                        </option>
                        <option value="500times">
                            {{ $t('按 500 次使用频率') }}
                        </option>
                    </select>
                </div>
            </div>
            <div class="opt-item">
                <div :class="checkDefault('close_respond')" />
                <div>
                    <label for="opt-function-close-respond">{{ $t('隐藏消息回应') }}</label>
                    <span>{{ $t('不在消息上显示回应入口') }}</span>
                </div>
                <label class="ss-switch">
                    <input id="opt-function-close-respond" v-model="settingsStore.sysConfig.close_respond"
                        type="checkbox" name="close_respond" @change="save">
                    <div>
                        <div />
                    </div>
                </label>
            </div>
            <div class="opt-item">
                <div :class="checkDefault('use_super_face')" />
                <div>
                    <label for="opt-function-use-super-face">{{ $t('超级表情') }}</label>
                    <span>{{ $t('播放大尺寸表情动画') }}</span>
                </div>
                <label class="ss-switch">
                    <input id="opt-function-use-super-face" v-model="settingsStore.sysConfig.use_super_face"
                        type="checkbox" name="use_super_face" @change="save">
                    <div>
                        <div />
                    </div>
                </label>
            </div>
            </div>
        </div>
        <div v-if="backend.isDesktop()" class="opt-group">
            <header class="opt-group-title">{{ $t('窗口') }}</header>
            <div class="opt-group-card">
            <div class="opt-item">
                <div :class="checkDefault('opt_always_top')" />
                <div>
                    <label for="opt-function-always-top">{{ $t('窗口置顶') }}</label>
                    <span>{{ $t('保持窗口始终可见') }}</span>
                </div>
                <label class="ss-switch">
                    <input id="opt-function-always-top" v-model="settingsStore.sysConfig.opt_always_top"
                        type="checkbox" name="opt_always_top" @change="save">
                    <div>
                        <div />
                    </div>
                </label>
            </div>
            </div>
        </div>
        <div v-if="backend.type === 'tauri'" class="opt-group">
            <header class="opt-group-title">{{ $t('消息存储') }}</header>
            <div class="opt-group-card">
            <div class="opt-item">
                <div :class="checkDefault('enable_local_history')" />
                <div>
                    <label for="opt-function-enable-local-history">{{ $t('本地保存消息') }}</label>
                    <span>{{ $t('将消息加密保存在本地') }}</span>
                </div>
                <label class="ss-switch">
                    <input id="opt-function-enable-local-history" v-model="settingsStore.sysConfig.enable_local_history"
                        type="checkbox" name="enable_local_history" @change="save">
                    <div>
                        <div />
                    </div>
                </label>
            </div>
            <div v-if="settingsStore.sysConfig.enable_local_history" class="tip">
                {{
                    $t('消息将以加密数据库的形式保存在本地。')
                }}
            </div>
            <div v-if="settingsStore.sysConfig.enable_local_history" class="opt-item">
                <div :class="checkDefault('mixed_load_messages')" />
                <div>
                    <label for="opt-function-mixed-load-messages">{{ $t('混合加载消息') }}</label>
                    <span>{{ $t('优先读取本地缓存，加快历史消息加载（实验性）') }}</span>
                </div>
                <label class="ss-switch">
                    <input id="opt-function-mixed-load-messages" v-model="settingsStore.sysConfig.mixed_load_messages"
                        type="checkbox"
                        name="mixed_load_messages"
                        @change="save">
                    <div>
                        <div />
                    </div>
                </label>
            </div>
            <div v-if="settingsStore.sysConfig.enable_local_history" class="opt-item">
                <div :class="checkDefault('disable_local_history_image_cache')" />
                <div>
                    <label for="opt-function-disable-local-history-image-cache">{{ $t('不保存图片缓存') }}</label>
                    <span>{{ $t('开启后删除已缓存图片，仅保留消息文本') }}</span>
                </div>
                <label class="ss-switch">
                    <input id="opt-function-disable-local-history-image-cache" v-model="settingsStore.sysConfig.disable_local_history_image_cache"
                        type="checkbox"
                        name="disable_local_history_image_cache"
                        @change="toggleLocalHistoryImageCache">
                    <div>
                        <div />
                    </div>
                </label>
            </div>
            <div v-if="settingsStore.sysConfig.enable_local_history && dbStats != null" class="db-stats-cards">
                <div class="db-stat-card">
                    <font-awesome-icon :icon="['fas', 'message']" />
                    <span class="db-stat-value">{{ dbStats.totalMessages.toLocaleString() }}</span>
                    <span class="db-stat-label">{{ $t('已存消息') }}</span>
                </div>
                <div class="db-stat-card">
                    <font-awesome-icon :icon="['fas', 'database']" />
                    <span class="db-stat-value">{{ formatDbSize(dbStats.dbSizeBytes) }}</span>
                    <span class="db-stat-label">{{ $t('数据库大小') }}</span>
                </div>
                <div class="db-stat-card">
                    <font-awesome-icon :icon="['fas', 'image']" />
                    <span class="db-stat-value">{{ dbStats.imageCount > 0 ? formatDbSize(dbStats.imageCacheBytes) : '-' }}</span>
                    <span class="db-stat-label">{{ $t('图片缓存') }}{{ dbStats.imageCount > 0 ? '\u00a0(' + dbStats.imageCount.toLocaleString() + ')' : '' }}</span>
                </div>
            </div>
            </div>
        </div>
        <div class="opt-group">
            <header class="opt-group-title">{{ $t('使用分析') }}</header>
            <div class="opt-group-card">
            <div class="opt-item">
                <div :class="checkDefault('close_ga')" />
                <div>
                    <label for="opt-function-close-ga">{{ $t('停用使用分析') }}</label>
                    <span>{{ $t('开启后不再上传匿名使用数据') }}</span>
                </div>
                <label class="ss-switch">
                    <input id="opt-function-close-ga" v-model="settingsStore.sysConfig.close_ga" type="checkbox"
                        name="close_ga" @change="save">
                    <div style="background: var(--color-card-2)">
                        <div />
                    </div>
                </label>
            </div>
            <div
                v-if="settingsStore.sysConfig.close_ga !== true"
                class="tip">
                {{
                    $t('使用分析仅上传匿名统计，不包含可识别个人的信息。')
                }}
            </div>
            <div v-if="settingsStore.sysConfig.close_ga !== true" class="opt-item">
                <div>
                    <span>{{ $t('查看分析数据') }}</span>
                    <span>{{ $t('了解已收集的匿名统计') }}</span>
                </div>
                <button style="width: 100px; font-size: 0.8rem"
                    class="ss-button" @click=" showUmamiInfo">
                    {{ $t('查看') }}
                </button>
            </div>
            <div v-if="settingsStore.sysConfig.close_ga !== true"
                class="opt-item">
                <div :class="checkDefault('open_ga_bot')" />
                <div>
                    <label for="opt-function-open-ga-bot">{{ $t('上报后端类型') }}</label>
                    <span>{{ $t('连接后统计所使用的协议实现') }}</span>
                </div>
                <label class="ss-switch">
                    <input id="opt-function-open-ga-bot" v-model="settingsStore.sysConfig.open_ga_bot" type="checkbox"
                        name="open_ga_bot" @change="save">
                    <div>
                        <div />
                    </div>
                </label>
            </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
    import { ref, watch, markRaw } from 'vue'
    import { PopInfo, PopType } from '@renderer/function/base'
    import { runASWEvent as save, checkDefault, runAS } from '@renderer/function/option'
    import { i18n } from '@chihiro/im-native/host'

    import UmamiInfoPan from '@renderer/components/user/UserUmamiInfoPan.vue'
    import { backend } from '@renderer/runtime/backend'
    import { dbClearImages, dbGetStats } from '@renderer/function/utils/localHistoryUtil'
    import { useSettingsStore } from '@renderer/state/settings'
    import { useAuthStore } from '@renderer/state/auth'
    import { useUIStore } from '@renderer/state/ui'

    const settingsStore = useSettingsStore()
    const authStore = useAuthStore()
    const uiStore = useUIStore()
    const $t = i18n.global.t

    defineOptions({ name: 'UserOptFunction' })

    const BOT_DEFAULT_KEY = 'chihiro-bot-new-default'
    const chihiroBotNewDefault = ref(localStorage.getItem(BOT_DEFAULT_KEY) === '1')
    function saveChihiroBotDefault() {
        localStorage.setItem(BOT_DEFAULT_KEY, chihiroBotNewDefault.value ? '1' : '0')
    }

    const dbStats = ref<{ totalMessages: number; imageCount: number; imageCacheBytes: number; dbSizeBytes: number } | null>(null)
    const clearImageProgressText = ref('')
    const ndt = ref(0)
    const ndv = ref(false)

    watch(() => authStore.loginInfo.uin, (uin) => {
        if (uin && settingsStore.sysConfig.enable_local_history) {
            loadDbStats()
        }
    }, { immediate: true })

    watch(() => settingsStore.sysConfig.enable_local_history, (enabled) => {
        if (enabled && authStore.loginInfo.uin) {
            loadDbStats()
        }
    }, { immediate: true })

    async function loadDbStats() {
        if (authStore.loginInfo?.uin) {
            dbStats.value = await dbGetStats(authStore.loginInfo.uin)
        }
    }

    function formatDbSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    }

    function showUmamiInfo() {
        const popInfo = {
            title: '',
            template: markRaw(UmamiInfoPan),
            full: true,
            allowQuickClose: false
        }
        uiStore.popBoxList.push(popInfo)
    }

    function msgND() {
        ndt.value++
        setTimeout(() => {
            ndv.value = false
        }, 300)
    }

    function toggleSessionDisplay(event: Event) {
        const sender = event.target as HTMLInputElement
        runAS('session_display_mode', sender.checked ? 'all' : 'recent')
    }

    function breakLineTip(event: Event) {
        const sender = event.target as HTMLInputElement
        if (sender.checked) {
            const popInfo = {
                title: $t('提醒'),
                html: `<span>${$t('开启多行模式可能会在一些拥有特殊选词模式的输入法上出现问题，如 微软注音2003、新注音2003 和 绝大部分很早期的拼音输入法；如果在使用的时候遇到问题可以尝试关闭此功能。（或者换个更现代的输入法）')}</span>`,
                button: [
                    {
                        text: $t('知道了'),
                        master: true,
                        fun: () => {
                            uiStore.popBoxList.shift()
                        },
                    },
                ],
            }
            uiStore.popBoxList.push(popInfo)
        }
    }

    function toggleLocalHistoryImageCache(event: Event) {
        save(event)

        const sender = event.target as HTMLInputElement
        if (!sender.checked) return

        const selfId = authStore.loginInfo?.uin
        if (!selfId) {
            new PopInfo().add(PopType.INFO, $t('请连接后在进行操作'))
            return
        }

        const popInfo = {
            title: $t('提醒'),
            html: `<span>${$t('确认要关闭图片缓存吗？所有已缓存图片都将被清除！')}</span>`,
            button: [
                {
                    text: $t('确认'),
                    fun: async() =>  {
                        uiStore.popBoxList.shift()

                        const progressPop = {
                            title: $t('提醒'),
                            html: `<span>${$t('正在清理图片缓存 0/0（0%）')}</span>`,
                            allowClose: false
                        }

                        clearImageProgressText.value = $t('正在清理图片缓存 0/0（0%）')
                        uiStore.popBoxList.push(progressPop)

                        const result = await dbClearImages(selfId, (progress) => {
                            const text = $t('正在清理图片缓存 {deleted}/{total}（{percent}%）', {
                                deleted: progress.deleted,
                                total: progress.total,
                                percent: progress.progress.toFixed(1),
                            })
                            clearImageProgressText.value = text
                            progressPop.html = `<span>${text}</span>`
                        })

                        if (uiStore.popBoxList.length > 0) {
                            uiStore.popBoxList.shift()
                        }

                        new PopInfo().add(
                            PopType.INFO,
                            $t('图片缓存清理完成，共删除 {count} 项（{batches} 批）。', {
                                count: result.deleted,
                                batches: result.batches,
                            }),
                        )
                        clearImageProgressText.value = ''
                        loadDbStats()
                    },
                },
                {
                    text: $t('取消'),
                    master: true,
                    fun: () => {
                        runAS('disable_local_history_image_cache', false)
                        uiStore.popBoxList.shift()
                    },
                }
            ],
        }
        uiStore.popBoxList.push(popInfo)
    }
</script>
<style>
    .ss-switch input:checked ~ div {
        background: var(--color-main) !important;
    }

    .ga-share {
        background: var(--color-card-2);
        border-radius: 7px;
        align-items: center;
        margin-top: 10px;
        cursor: pointer;
        display: flex;
        padding: 10px 20px;
    }

    .ga-share > svg {
        fill: var(--color-font);
        margin-right: 10px;
        width: 20px;
    }

    .ga-share > a {
        text-decoration: underline;
        color: var(--color-font-1);
        font-size: 0.8rem;
    }

    .db-stats-cards {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin: 4px 0 8px;
    }

    .db-stat-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 12px 8px;
        border-radius: 7px;
        min-width: 0;
    }

    .db-stat-card > svg {
        width: 16px;
        height: 16px;
        opacity: 0.5;
        flex-shrink: 0;
    }

    .db-stat-value {
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-font);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
    }

    .db-stat-label {
        font-size: 0.72rem;
        color: var(--color-font-2);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
    }
</style>
