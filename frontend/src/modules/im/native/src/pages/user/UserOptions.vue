<!--
 * @FileDescription: 设置页面
 * @Author: Stapxs
 * @Date: 2022/09/26
 * @Version: 1.0
-->
 <!-- eslint-disable max-len -->

<template>
    <div :class="['opt-main', { 'opt-fast-animation': settingsStore.sysConfig.opt_fast_animation === true }]">
        <header v-show="show" class="opt-content-header">
            <slot name="leading" />
            <span>{{ $t('设置') }}</span>
        </header>
        <aside v-show="show" class="opt-sidebar">
            <nav class="opt-nav" :aria-label="$t('设置')">
                <button v-for="tab in tabs" :key="tab.id" type="button"
                    :class="['opt-nav-item', { active: activeTab === tab.id }]"
                    :aria-current="activeTab === tab.id ? 'page' : undefined"
                    @click="activeTab = tab.id">
                    <font-awesome-icon :icon="tab.icon" />
                    <span>{{ $t(tab.label) }}</span>
                </button>
            </nav>
        </aside>
        <section v-show="show" class="opt-content">
            <div class="opt-content-scroll">
                <div v-show="activeTab === 'view'" class="opt-panel">
                    <h2 class="opt-panel-title">{{ $t('界面') }}</h2>
                    <OptView />
                </div>
                <div v-show="activeTab === 'function'" class="opt-panel">
                    <h2 class="opt-panel-title">{{ $t('功能') }}</h2>
                    <OptFunction :config="config" />
                </div>
                <div v-show="activeTab === 'addon'" class="opt-panel">
                    <h2 class="opt-panel-title">{{ $t('附加') }}</h2>
                    <OptAddon />
                </div>
                <div v-show="activeTab === 'dev'" class="opt-panel">
                    <h2 class="opt-panel-title">{{ $t('高级') }}</h2>
                    <OptDev />
                </div>
                <div v-show="activeTab === 'about'" class="opt-panel opt-about">
                    <a class="opt-about-brand" href="https://supply.boft.ai" target="_blank" rel="noreferrer">
                        <video class="opt-about-brand-video" :src="liberseekLogoVideoUrl" autoplay loop muted playsinline />
                        <div class="opt-about-brand-copy">
                            <span class="opt-about-brand-name">LIBERSEEK</span>
                            <span class="opt-about-brand-tagline">向未来探索</span>
                        </div>
                    </a>
                </div>
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
    import { ref } from 'vue'

    import { i18n } from '@chihiro/im-native/host'
    import { useSettingsStore } from '@renderer/state/settings'
    import liberseekLogoVideoUrl from '@/assets/liberseek-logo-animated.mp4'
    import type { IconProp } from '@fortawesome/fontawesome-svg-core'

    import OptView from '@renderer/pages/user/UserOptView.vue'
    import OptDev from '@renderer/pages/user/UserOptDev.vue'
    import OptFunction from '@renderer/pages/user/UserOptFunction.vue'
    import OptAddon from '@renderer/pages/user/UserOptAddon.vue'

    defineOptions({ name: 'UserOptions' })

    const $t = i18n.global.t
    const settingsStore = useSettingsStore()

    type SettingsTabId = 'view' | 'function' | 'addon' | 'dev' | 'about'
    type SettingsTab = { id: SettingsTabId, label: string, icon: IconProp }

    const tabs: SettingsTab[] = [
        { id: 'view', label: '界面', icon: ['fas', 'display'] },
        { id: 'function', label: '功能', icon: ['fas', 'sliders'] },
        { id: 'addon', label: '附加', icon: ['fas', 'puzzle-piece'] },
        { id: 'dev', label: '高级', icon: ['fas', 'code'] },
        { id: 'about', label: '关于', icon: ['fas', 'circle-info'] },
    ]

    const activeTab = ref<SettingsTabId>('view')

    defineProps({
        show: Boolean,
        config: {
            type: Object,
            default: () => ({} as
                { [key: string]: string | number | boolean }),
        },
    })

</script>
