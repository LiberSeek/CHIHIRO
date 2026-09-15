<!--
 * @FileDescription: 设置页面（界面子页面）
 * @Author: Stapxs
 * @Date: 2022/09/26
 * @Version: 1.0
-->

<template>
    <div class="opt-page">
        <div class="opt-group">
            <header class="opt-group-title">{{ $t('语言') }}</header>
            <div class="opt-group-card">
            <div class="opt-item">
                <div :class="checkDefault('language')" />
                <div>
                    <label for="opt-view-language">{{ $t('界面语言') }}</label>
                    <span>{{ $t('更改后立即生效') }}</span>
                </div>
                <div class="select-wrapper">
                    <select id="opt-view-language"
                        v-model="settingsStore.sysConfig.language"
                        name="language" title="language"
                        @change="save($event);gaLanguage($event)">
                        <option v-for="item in languages" :key="item.value" :value="item.value">
                            {{ item.name }}
                        </option>
                    </select>
                </div>
            </div>
            </div>
        </div>
        <div v-if="backend.isMobile()" class="opt-group">
            <header class="opt-group-title">{{ $t('图标') }}</header>
            <div class="opt-group-card">
            <div class="icon-list">
                <div v-for="item in getIconList()"
                    :key="item.name"
                    :class="item.name === usedIcon ? 'selected' : ''"
                    @click="changeIcon(item.name)">
                    <img :src="item.icon">
                    <span>{{ $t(item.name != '' ? item.name : '默认') }}</span>
                </div>
            </div>
            </div>
        </div>
        <div v-if="!napcat" class="opt-group">
            <header class="opt-group-title">{{ $t('外观') }}</header>
            <div class="opt-group-card">
            <template v-if="settingsStore.sysConfig.opt_auto_gtk != true">
                <div id="opt_view_dark" class="opt-item">
                    <div :class="checkDefault('opt_view_dark')" />
                    <div>
                        <label for="opt-view-dark">{{ $t('深色模式') }}</label>
                        <span>{{ $t('使用深色外观') }}</span>
                    </div>
                    <label class="ss-switch">
                        <input id="opt-view-dark" v-model="settingsStore.sysConfig.opt_dark"
                            type="checkbox" name="opt_dark" @change="save">
                        <div>
                            <div />
                        </div>
                    </label>
                </div>
                <div class="opt-item">
                    <div :class="checkDefault('opt_auto_dark')" />
                    <div>
                        <label for="opt-view-auto-dark">{{ $t('跟随系统外观') }}</label>
                        <span>{{ $t('根据系统设置自动切换浅色或深色') }}</span>
                    </div>
                    <label class="ss-switch">
                        <input id="opt-view-auto-dark" v-model="settingsStore.sysConfig.opt_auto_dark"
                            type="checkbox" name="opt_auto_dark" @change="save">
                        <div>
                            <div />
                        </div>
                    </label>
                </div>
                <template v-if="settingsStore.sysConfig.opt_auto_win_color != true">
                    <div class="opt-item">
                        <div :class="checkDefault('theme_color')" />
                        <div>
                            <span>{{ $t('主题色') }}</span>
                            <span>{{ $t('自定义界面强调色') }}</span>
                        </div>
                        <div class="theme-swatches" role="radiogroup" :aria-label="$t('主题色')">
                            <button
                                v-for="(name, index) in colors"
                                :key="'color_id_' + index"
                                type="button"
                                class="theme-swatch"
                                :class="{ selected: isPresetThemeColor(index) }"
                                :title="$t(name)"
                                :aria-label="$t(name)"
                                :aria-pressed="isPresetThemeColor(index)"
                                :style="{ background: themeSwatchColors[index] }"
                                @click="selectThemeColor(index)">
                            </button>
                            <button
                                type="button"
                                class="theme-swatch theme-swatch-custom"
                                :class="{ selected: isCustomThemeColor }"
                                :title="$t('自定义')"
                                :aria-label="$t('自定义')"
                                :aria-pressed="isCustomThemeColor"
                                @click="themeColorChange">
                            </button>
                        </div>
                    </div>
                </template>
            </template>
            <template v-if="backend.isDesktop() && browser.os != 'Linux'">
                <div class="opt-item">
                    <div :class="checkDefault('opt_auto_win_color')" />
                    <div>
                        <label for="opt-view-auto-win-color">{{ $t('跟随系统主题色') }}</label>
                        <span>{{ $t('使用系统当前的强调色') }}</span>
                    </div>
                    <label class="ss-switch">
                        <input id="opt-view-auto-win-color" v-model="settingsStore.sysConfig.opt_auto_win_color"
                            type="checkbox" name="opt_auto_win_color" @change="save">
                        <div>
                            <div />
                        </div>
                    </label>
                </div>
            </template>
            <div class="opt-item">
                <div :class="checkDefault('chat_more_blur')" />
                <div>
                    <label for="opt-view-chat-more-blur">{{ $t('透明效果') }}</label>
                    <span>{{ $t('增强界面透明与模糊，可能影响性能') }}</span>
                </div>
                <label class="ss-switch">
                    <input id="opt-view-chat-more-blur" v-model="settingsStore.sysConfig.chat_more_blur"
                        type="checkbox" name="chat_more_blur" @change="blurTip">
                    <div>
                        <div />
                    </div>
                </label>
            </div>
            <div v-if="settingsStore.sysConfig.chat_more_blur && backend.platform === 'darwin' && Number(backend.release.split(' ')[1].split('.')[0]) >= 26" class="opt-item">
                <div :class="checkDefault('glass_effect')" />
                <div>
                    <label for="opt-view-glass-effect">{{ $t('原生玻璃效果') }}</label>
                    <span>{{ $t('仅支持 macOS 26 及以上系统') }}</span>
                </div>
                <label class="ss-switch">
                    <input id="opt-view-glass-effect" v-model="settingsStore.sysConfig.glass_effect"
                        type="checkbox" name="glass_effect" @change="glassEffectToggle">
                    <div>
                        <div />
                    </div>
                </label>
            </div>
            <div class="opt-item">
                <div :class="checkDefault('chat_background')" />
                <div>
                    <span>{{ $t('聊天背景') }}</span>
                    <span>{{ $t('为会话页面设置自定义背景') }}</span>
                </div>
                <div class="file-choice">
                    <div class="choice-btn"
                        @click="setBackground">
                        {{
                            settingsStore.sysConfig.chat_background
                                ? $t('更换背景')
                                : $t('选择背景')
                        }}
                        <input id="opt-view-chat-background"
                            ref="choiceImgRef"
                            type="file"
                            style="display: none"
                            name="chat_background"
                            accept="image/*"
                            @change="setBackgroundFromInput($event)">
                        <label for="opt-view-chat-background" class="sr-only">{{ $t('选择背景图片') }}</label>
                    </div>
                    <div v-if="settingsStore.sysConfig.chat_background !== ''"
                        class="rm-btn"
                        @click="removeBackground">
                        <font-awesome-icon :icon="['fas', 'xmark']" />
                    </div>
                </div>
            </div>
            <div class="opt-item">
                <div :class="checkDefault('chat_background_blur')" />
                <template v-if="!settingsStore.sysConfig.chat_more_blur">
                    <div>
                        <label for="opt-view-background-blur">{{ $t('背景模糊') }}</label>
                        <span>{{ $t('调整背景图片的模糊程度') }}</span>
                    </div>
                    <div class="ss-range" :style="{ '--range-precent': `${Number(settingsStore.sysConfig.chat_background_blur) || 0}%` }">
                        <input id="opt-view-background-blur" v-model="settingsStore.sysConfig.chat_background_blur"
                            type="range" min="0" max="100" name="chat_background_blur" @input="save">
                        <div />
                        <span>{{ settingsStore.sysConfig.chat_background_blur || 0 }} px</span>
                    </div>
                </template>
                <template v-else>
                    <div>
                        <label for="opt-view-background-opacity">{{ $t('背景透明度') }}</label>
                        <span>{{ $t('调整背景图片的不透明度') }}</span>
                    </div>
                    <div class="ss-range" :style="{ '--range-precent': `${Number(settingsStore.sysConfig.chat_background_blur) || 0}%` }">
                        <input id="opt-view-background-opacity" v-model="settingsStore.sysConfig.chat_background_blur"
                            type="range" min="0" max="100" name="chat_background_blur"
                            @input="save">
                        <div />
                        <span>{{ settingsStore.sysConfig.chat_background_blur || 0 }}%</span>
                    </div>
                </template>
            </div>
            <div class="opt-item">
                <div :class="checkDefault('chat_background_align')" />
                <div>
                    <label for="opt-view-background-align">{{ $t('背景对齐') }}</label>
                    <span>{{ $t('调整背景图片的对齐位置') }}</span>
                </div>
                <div class="select-wrapper">
                    <select id="opt-view-background-align"
                        v-model="settingsStore.sysConfig.chat_background_align"
                        name="chat_background_align" title="chat_background_align"
                        @change="save($event)">
                        <option value="center">
                            {{ $t('居中') }}
                        </option>
                        <option value="top">
                            {{ $t('顶部') }}
                        </option>
                        <option value="bottom">
                            {{ $t('底部') }}
                        </option>
                        <option value="left">
                            {{ $t('左侧') }}
                        </option>
                        <option value="right">
                            {{ $t('右侧') }}
                        </option>
                    </select>
                </div>
            </div>
            <div class="opt-item">
                <div :class="checkDefault('chat_background_fit')" />
                <div>
                    <label for="opt-view-background-fit">{{ $t('背景填充') }}</label>
                    <span>{{ $t('调整背景图片的填充方式') }}</span>
                </div>
                <div class="select-wrapper">
                    <select id="opt-view-background-fit"
                        v-model="settingsStore.sysConfig.chat_background_fit"
                        name="chat_background_fit" title="chat_background_fit"
                        @change="save($event)">
                        <option value="cover">
                            {{ $t('覆盖') }}
                        </option>
                        <option value="contain">
                            {{ $t('包含') }}
                        </option>
                        <option value="fill">
                            {{ $t('拉伸') }}
                        </option>
                        <option value="none">
                            {{ $t('原始大小') }}
                        </option>
                    </select>
                </div>
            </div>
            </div>
        </div>
        <div class="opt-group">
            <header class="opt-group-title">{{ $t('聊天界面') }}</header>
            <div class="opt-group-card">
            <div class="opt-item">
                <div :class="checkDefault('chatview_name')" />
                <div>
                    <label for="opt-view-chatview-name">{{ $t('会话布局') }}</label>
                    <span>{{ $t('选择会话页面的显示样式') }}</span>
                </div>
                <div class="select-wrapper">
                    <select id="opt-view-chatview-name"
                        v-model="settingsStore.sysConfig.chatview_name"
                        name="chatview_name" title="chatview_name"
                        @change="save($event);gaChatView($event)">
                        <option value="">
                            {{ $t('默认') }}
                        </option>
                        <option v-for="item in getAppendChatView()"
                            :key="item" :value="item">
                            {{ item.replace('Chat', '').replace(/^['"]|['"]$/g, '').trim() }}
                        </option>
                    </select>
                </div>
            </div>
            <div class="opt-item">
                <div :class="checkDefault('quick_send')" />
                <div>
                    <label for="opt-view-quick-send">{{ $t('快捷功能按钮') }}</label>
                    <span>{{ $t('设置输入栏默认功能，右键可临时切换') }}</span>
                </div>
                <div class="select-wrapper">
                    <select id="opt-view-quick-send" v-model="settingsStore.sysConfig.quick_send" name="quick_send"
                        title="quick_send" @change="save">
                        <option value="default">
                            {{ $t('默认') }}
                        </option>
                        <option value="img">
                            {{ $t('图片') }}
                        </option>
                        <option value="file">
                            {{ $t('文件') }}
                        </option>
                        <option value="face">
                            {{ $t('表情') }}
                        </option>
                    </select>
                </div>
            </div>
            <div class="opt-item">
                <div :class="checkDefault('opt_ind_message')" />
                <div>
                    <label for="opt-view-ind-message">{{ $t('自己的消息靠右显示') }}</label>
                    <span>{{ $t('将自己发送的消息显示在会话右侧') }}</span>
                </div>
                <label class="ss-switch">
                    <input id="opt-view-ind-message" v-model="settingsStore.sysConfig.opt_ind_message"
                        type="checkbox" name="opt_ind_message" @change="save">
                    <div>
                        <div />
                    </div>
                </label>
            </div>
            <div class="opt-item">
                <div :class="checkDefault('opt_fast_animation')" />
                <div>
                    <label for="opt-view-fast-animation">{{ $t('减少动画') }}</label>
                    <span>{{ $t('缩短过渡时间，提升操作响应') }}</span>
                </div>
                <label class="ss-switch">
                    <input id="opt-view-fast-animation" v-model="settingsStore.sysConfig.opt_fast_animation"
                        type="checkbox" name="opt_fast_animation" @change="save">
                    <div>
                        <div />
                    </div>
                </label>
            </div>
            <div v-if="isMobile() && !backend.isMobile()"
                class="opt-item">
                <div :class="checkDefault('initial_scale')" />
                <div>
                    <label for="opt-view-initial-scale">{{ $t('缩放比例') }}</label>
                    <span>{{ $t('调整移动端页面缩放') }}</span>
                </div>
                <div class="ss-range" :style="{ '--range-precent': `${(initialScaleShow - 0.5) / 0.01}%` }">
                    <input id="opt-view-initial-scale" v-model="settingsStore.sysConfig.initial_scale"
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.01"
                        name="initial_scale"
                        @change="scaleSave"
                        @input="setInitialScaleShow">
                    <div />
                    <span :style="{ 'color': `var(--color-font${initialScaleShow / 0.05 })` }">
                        {{ initialScaleShow }}</span>
                </div>
            </div>
            <div
                v-if="isMobile() && !backend.isMobile()"
                class="opt-item">
                <div :class="checkDefault('fs_adaptation')" />
                <div>
                    <label for="opt-view-fs-adaptation">{{ $t('圆角适配') }}</label>
                    <span>{{ $t('为全面屏设备预留安全边距') }}</span>
                </div>
                <div class="ss-range" :style="{ '--range-precent': `${(fsAdaptationShow / 50) * 100}%` }">
                    <input id="opt-view-fs-adaptation" v-model="settingsStore.sysConfig.fs_adaptation"
                        type="range"
                        min="0"
                        max="50"
                        step="10"
                        name="fs_adaptation"
                        @change="save"
                        @input="setFsAdaptationShow">
                    <div />
                    <span :style="{ 'color': `var(--color-font${fsAdaptationShow / 50 > 0.5 ? '-r' : ''})` }">
                        {{ fsAdaptationShow }} px
                    </span>
                </div>
            </div>
            <div v-if="backend.type == 'web' && !napcat" class="opt-item">
                <div :class="checkDefault('use_favicon_notice')" />
                <div>
                    <label for="opt-view-favicon-notice">{{ $t('在应用图标上显示未读') }}</label>
                    <span>{{ $t('用图标角标提示未读消息') }}</span>
                </div>
                <label class="ss-switch">
                    <input id="opt-view-favicon-notice" v-model="settingsStore.sysConfig.use_favicon_notice"
                        type="checkbox" name="use_favicon_notice" @change="save">
                    <div>
                        <div />
                    </div>
                </label>
            </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, markRaw, onMounted, ref, toRaw, useTemplateRef, watch } from 'vue'
import Option, { run, runASWEvent as save, checkDefault, runAS } from '../../function/option'
import { BrowserInfo, detect } from 'detect-browser'
import { getDeviceType } from '@renderer/function/utils/systemUtil'

import languages from '../../assets/l10n/_l10nconfig.json'
import { sendIdentifyData } from '@renderer/function/utils/appUtil'
import { backend } from '@renderer/runtime/backend'
import {
    rememberLocalImageUrl,
    resolveLocalImageUrl,
    saveBrowserBackgroundImage,
    type LocalImageInfo,
} from '@renderer/function/utils/backgroundUtil'
import { i18n } from '@chihiro/im-native/host'
import { useSettingsStore } from '@renderer/state/settings'
import { useUIStore } from '@renderer/state/ui'
import ThemeColorPickerPan from '@renderer/components/user/UserThemeColorPickerPan.vue'

const settingsStore = useSettingsStore()
const uiStore = useUIStore()

defineOptions({ name: 'UserOptView' })

const $t = i18n.global.t

const napcat = import.meta.env.VITE_NAPCAT
const colors = [
    '蓝色',
    '青色',
    '粉色',
    '紫色',
    '黄色',
    '黑色',
]
const themeSwatchColors = [
    '#007aff',
    '#32ade6',
    '#ff2d55',
    '#af52de',
    '#ffcc00',
    '#636366',
]
const browser = detect() as BrowserInfo

const initialScaleShow = ref(0.5)
const fsAdaptationShow = ref(0)
const usedIcon = ref('')
const themeColorRaw = ref('')
const themeColorDraft = ref('')
const themeColorHistory = ref<string[]>([])

const THEME_COLOR_HISTORY_KEY = 'theme_color_history'
const THEME_COLOR_HISTORY_LIMIT = 12

const choiceImgRef = useTemplateRef<HTMLInputElement>('choiceImgRef')

onMounted(() => {
    themeColorRaw.value = getThemeColorRawValue()
    themeColorHistory.value = loadThemeColorHistory()
    // 一次性初始化一次缩放级别
    const unwatch = watch(
        () => settingsStore.sysConfig,
        () => {
            initialScaleShow.value = toRaw(
                settingsStore.sysConfig.initial_scale,
            )
            fsAdaptationShow.value = toRaw(
                settingsStore.sysConfig.fs_adaptation,
            )
            unwatch()
        },
    )
    // 获取当前使用的图标
    const Onebot = (window.Capacitor as any)?.Plugins?.Onebot
    if (Onebot) {
        Onebot.addListener('onebot:icon', (data: any) => {
            usedIcon.value = data.name.replace('AppIcon', '')
        })
        Onebot.getUsedIcon()
    }

    watch(
        () => settingsStore.sysConfig.theme_color,
        () => {
            themeColorRaw.value = getThemeColorRawValue()
        },
    )
})

function gaLanguage(event: Event) {
    const sender = event.target as HTMLInputElement
    sendIdentifyData({ use_language: sender.value })
}

function gaChatView(event: Event) {
    const sender = event.target as HTMLInputElement
    sendIdentifyData({ use_chatview: sender.value })
}

function isPresetThemeColor(index: number) {
    const current = Number(settingsStore.sysConfig.theme_color)
    if (settingsStore.sysConfig.theme_color === undefined || Number.isNaN(current)) {
        return index === 0
    }
    return current === index
}

const isCustomThemeColor = computed(() => Number(settingsStore.sysConfig.theme_color) > 10)

function selectThemeColor(index: number) {
    runAS('theme_color', index)
    sendIdentifyData({ use_theme_color: colors[index] })
}

function themeColorChange(event: Event) {
    event.preventDefault()
    const originThemeColorValue = Number(settingsStore.sysConfig.theme_color ?? 0)
    themeColorDraft.value = getThemeColorRawValue()
    uiStore.popBoxList.push({
        title: $t('主题色'),
        allowQuickClose: true,
        onClose: () => {
            restoreThemeColor(originThemeColorValue)
        },
        template: markRaw(ThemeColorPickerPan),
        templateValue: {
            modelValue: themeColorDraft.value,
            onChange: (value: string) => {
                themeColorDraft.value = normalizeHexColor(value)
                run('theme_color', parseInt(themeColorDraft.value.slice(1), 16))
            },
            historyColors: themeColorHistory.value,
        },
        button: [
            {
                text: $t('取消'),
                fun: () => {
                    restoreThemeColor(originThemeColorValue)
                    uiStore.popBoxList[0].onClose = undefined
                    uiStore.popBoxList.shift()
                },
            },
            {
                text: $t('确认'),
                master: true,
                fun: () => {
                    const saveColor = normalizeHexColor(themeColorDraft.value)
                    themeColorRaw.value = saveColor
                    themeColorHistory.value = saveThemeColorHistory(saveColor)
                    uiStore.popBoxList[0].onClose = undefined
                    runAS('theme_color', parseInt(saveColor.slice(1), 16))
                    uiStore.popBoxList.shift()
                },
            },
        ],
    })
}

function getThemeColorRawValue() {
    const currentValue = Number(settingsStore.sysConfig.theme_color ?? 0)
    if (currentValue > 10) {
        return '#' + ('000000' + currentValue.toString(16)).slice(-6).toUpperCase()
    }
    const cssColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-main')
    return cssColorToHex(cssColor)
}

function restoreThemeColor(themeColorValue: number) {
    run('theme_color', themeColorValue)
    themeColorRaw.value = getThemeColorRawValue()
}

function loadThemeColorHistory() {
    const cookieValue = getCookie(THEME_COLOR_HISTORY_KEY)
    let storageValue = null as string | null
    try {
        storageValue = globalThis.localStorage?.getItem(THEME_COLOR_HISTORY_KEY) ?? null
    } catch {
        // ignore
    }
    const source = cookieValue ?? storageValue
    if (!source) {
        return []
    }
    try {
        const parsed = JSON.parse(source)
        if (!Array.isArray(parsed)) {
            return []
        }
        return parsed
            .map((item) => normalizeHexColor(String(item)))
            .filter((item, index, list) => list.indexOf(item) === index)
            .slice(0, THEME_COLOR_HISTORY_LIMIT)
    } catch {
        return []
    }
}

function saveThemeColorHistory(color: string) {
    const normalized = normalizeHexColor(color)
    const nextHistory = [
        normalized,
        ...themeColorHistory.value.filter((item) => item !== normalized),
    ].slice(0, THEME_COLOR_HISTORY_LIMIT)
    const serialized = JSON.stringify(nextHistory)
    setCookie(THEME_COLOR_HISTORY_KEY, serialized, 3650)
    try {
        globalThis.localStorage?.setItem(THEME_COLOR_HISTORY_KEY, serialized)
    } catch {
        // ignore
    }
    return nextHistory
}

function getCookie(name: string) {
    if (typeof document === 'undefined') {
        return null
    }
    const prefix = `${name}=`
    const cookie = document.cookie
        .split('; ')
        .find((item) => item.startsWith(prefix))
    return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null
}

function setCookie(name: string, value: string, days: number) {
    if (typeof document === 'undefined') {
        return
    }
    const expires = new Date()
    expires.setDate(expires.getDate() + days)
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`
}

function cssColorToHex(color: string) {
    const value = color.trim()
    if (value.startsWith('#')) {
        return normalizeHexColor(value)
    }
    const match = value.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i)
    if (!match) {
        return '#FFFFFF'
    }
    return '#' + match.slice(1, 4).map((item) => {
        return Number(item).toString(16).padStart(2, '0')
    }).join('').toUpperCase()
}

function normalizeHexColor(color: string | undefined) {
    const value = (color ?? '').trim()
    const match = value.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
    if (!match) {
        return '#FFFFFF'
    }
    const hex = match[1]
    if (hex.length === 3) {
        return '#' + hex.split('').map((item) => item + item).join('').toUpperCase()
    }
    return '#' + hex.toUpperCase()
}

function blurTip(event: Event) {
    const sender = event.target as HTMLInputElement
    if (sender.checked) {
        const popInfo = {
            title: $t('提醒'),
            html: `<span>${$t('开启透明模式将会对性能产生较为明显的影响，建议不要在性能较差的设备上使用此功能；此功能与"背景图片"的部分功能冲突同时会降低元素可读性。')}<br><br>
                        ${$t('开启后需要重启应用才能生效，确定要开启吗？')}</span>`,
            button: [
                {
                    text: $t('确认'),
                    fun: () => {
                        uiStore.popBoxList.shift()
                        save(event)
                        sendIdentifyData({ use_transparent: true })
                        setTimeout(() => {
                            restartapp()
                        }, 500)
                    },
                },
                {
                    text: $t('取消'),
                    master: true,
                    fun: () => {
                        uiStore.popBoxList.shift()
                        sender.checked = false
                    },
                },
            ],
        }
        uiStore.popBoxList.push(popInfo)
    } else {
        const popInfo = {
            title: $t('提醒'),
            html: `<span>${$t('关闭透明模式需要重启应用才能生效。')}<br><br>
                        ${$t('确定要重启吗？')}</span>`,
            button: [
                {
                    text: $t('确认'),
                    fun: () => {
                        uiStore.popBoxList.shift()
                        save(event)
                        sendIdentifyData({ use_transparent: false })
                        setTimeout(() => {
                            restartapp()
                        }, 500)
                    },
                },
                {
                    text: $t('取消'),
                    master: true,
                    fun: () => {
                        uiStore.popBoxList.shift()
                        sender.checked = true
                    },
                },
            ],
        }
        uiStore.popBoxList.push(popInfo)
    }
}

function scaleSave(event: Event) {
    save(event)
    // 5 秒后自动取消防止误操作导致无法恢复
    const timerId = setTimeout(() => {
        (event.target as HTMLInputElement).value = '0.85'
        settingsStore.sysConfig.initial_scale = 0.85
        initialScaleShow.value = 0.85
        save(event)
        uiStore.popBoxList.pop()
        const popInfo = {
            svg: 'up-down-left-right',
            html: '<span>' + $t('缩放比例调整已取消，已恢复默认缩放比例。') + '</span>',
            title: $t('确认缩放比例'),
            button: [
                {
                    text: $t('取消'),
                    master: true,
                    fun: () => {
                        uiStore.popBoxList.pop()
                    },
                }
            ],
        }
        uiStore.popBoxList.push(popInfo)
    }, 5000)
    // 保存提醒
    const popInfo = {
        svg: 'up-down-left-right',
        html: '<span>' + $t('点击确认以应用缩放比例，预览将在 5 秒后取消……') + '</span>',
        title: $t('确认缩放比例'),
        button: [
            {
                text: $t('确定'),
                fun: () => {
                    uiStore.popBoxList.pop()
                    clearTimeout(timerId)
                },
            }
        ],
    }
    uiStore.popBoxList.push(popInfo)
}

function setInitialScaleShow(event: Event) {
    const sender = event.target as HTMLInputElement
    initialScaleShow.value = Number(sender.value)
}

function setFsAdaptationShow(event: Event) {
    const sender = event.target as HTMLInputElement
    fsAdaptationShow.value = Number(sender.value)
}

function restartapp() {
    backend.call(undefined, 'win:relaunch', false)
}

function isMobile() {
    return (
        getDeviceType() === 'Android' || getDeviceType() === 'iOS'
    )
}

function getAppendChatView() {
    const chatView = {
        ...import.meta.glob('@renderer/pages/user/User*.vue', { eager: true }),
        ...import.meta.glob('@renderer/pages/chat-view/*.vue', { eager: true }),
    }
    const chatViewList: string[] = []
    Object.keys(chatView).forEach((key: string) => {
        let name = key.split('/').pop()?.split('.')[0]
        name = name ? name.toString().replaceAll(/(^['"]|['"]$)/g, '').trim() : name
        if (name && (name.startsWith('UserChat') || name.startsWith('Chat'))) {
            chatViewList.push(name)
        }
    })
    return chatViewList
}

function getIconList() {
    const iconList = import.meta.glob('@renderer/assets/img/icons/*.png', { eager: true })
    const iconListInfo = [] as { name: string, icon: any }[]
    Object.keys(iconList).forEach((key: string) => {
        const name = key.split('/').pop()?.split('.')[0]
        const iconName = name?.replace('AppIcon', '')
        if( name && name.indexOf('AppIcon') >= 0 && iconName != undefined) {
            if(!settingsStore.darkMode && !iconName.endsWith('Dark')) {
                iconListInfo.push({ name: iconName, icon: (iconList[key] as any).default })
            } else if(settingsStore.darkMode && iconName.endsWith('Dark')) {
                iconListInfo.push({ name: iconName.replace('Dark', ''), icon: (iconList[key] as any).default })
            }
        }
    })
    return iconListInfo
}

function changeIcon(name: string) {
    backend.call('Onebot', 'changeIcon', false, { name: name != '' ? (name + 'AppIcon') : name })
    usedIcon.value = name
}

/**
 * 设置背景图片
 */
async function setBackground() {
    if (backend.isDesktop()) {
        const image = await backend.call(undefined, 'sys:selectImage', true) as LocalImageInfo | null
        if (!image) return
        const imageUrl = await resolveLocalImageUrl(image)
        settingsStore.sysConfig.chat_background = imageUrl
        rememberLocalImageUrl(image.path, imageUrl)
        Option.runAS('chat_background', imageUrl)
        return
    }
    choiceImgRef.value?.click()
}

async function setBackgroundFromInput(event: Event) {
    const sender = event.target as HTMLInputElement
    const img = sender.files?.[0]
    if (!img) return
    const backgroundUrl = await saveBrowserBackgroundImage(img)
    const imgSrc = URL.createObjectURL(img)
    rememberLocalImageUrl(backgroundUrl, imgSrc)
    settingsStore.sysConfig.chat_background = backgroundUrl
    Option.runAS('chat_background', backgroundUrl)
    sender.value = ''
}

/**
 * 移除背景图片
 */
function removeBackground() {
    settingsStore.sysConfig.chat_background = ''
    Option.runAS('chat_background', '')
}

/**
 * 切换 Glass Effect
 */
function glassEffectToggle(event: Event) {
    const sender = event.target as HTMLInputElement

    if (sender.checked) {
        const popInfo = {
            title: $t('提醒'),
            html: `<span>${$t('开启原生玻璃效果需要重启应用才能生效。')}<br><br>
                        ${$t('确定要重启吗？')}</span>`,
            button: [
                {
                    text: $t('确认'),
                    fun: () => {
                        uiStore.popBoxList.shift()
                        save(event)
                        setTimeout(() => {
                            restartapp()
                        }, 500)
                    },
                },
                {
                    text: $t('取消'),
                    master: true,
                    fun: () => {
                        uiStore.popBoxList.shift()
                        sender.checked = false
                    },
                },
            ],
        }
        uiStore.popBoxList.push(popInfo)
    } else {
        const popInfo = {
            title: $t('提醒'),
            html: `<span>${$t('关闭流体玻璃效果需要重启应用才能生效')}<br><br>
                        ${$t('确定要重启吗？')}</span>`,
            button: [
                {
                    text: $t('确认'),
                    fun: () => {
                        uiStore.popBoxList.shift()
                        save(event)
                        setTimeout(() => {
                            restartapp()
                        }, 500)
                    },
                },
                {
                    text: $t('取消'),
                    master: true,
                    fun: () => {
                        uiStore.popBoxList.shift()
                        sender.checked = true
                    },
                },
            ],
        }
        uiStore.popBoxList.push(popInfo)
    }
}
</script>
