<!--
 * @FileDescription: 设置页面（附加子页面）
 * @Author: Stapxs
 * @Date: 2026/04/07
 * @Version: 1.0
-->
<!-- eslint-disable max-len -->

<template>
    <div class="opt-page">
        <template v-if="cards.length > 0">
            <div v-for="card in cards" :key="card.id" class="opt-group">
                <header class="opt-group-title">{{ card.title }}</header>
                <div class="opt-group-card">
                <div v-if="card.description" class="tip">
                    {{ card.description }}
                </div>
                <div v-for="item in card.items" :key="item.id" class="opt-item">
                    <template v-if="item.type === 'switch'">
                        <font-awesome-icon
                            :icon="item.icon || ['fas', 'robot']" />
                        <div>
                            <label :for="`opt-addon-switch-${item.id}`">{{ item.label }}</label>
                            <span v-if="item.description">{{ item.description }}</span>
                        </div>
                        <label class="ss-switch">
                            <input :id="`opt-addon-switch-${item.id}`" :checked="getItemValue(item) === true"
                                type="checkbox" @change="onSwitchChange($event, item)">
                            <div><div /></div>
                        </label>
                    </template>
                    <template v-else-if="item.type === 'input'">
                        <font-awesome-icon
                            :icon="item.icon || ['fas', 'paper-plane']" />
                        <div>
                            <label :for="`opt-addon-input-${item.id}`">{{ item.label }}</label>
                            <span v-if="item.description">{{ item.description }}</span>
                        </div>
                        <input :id="`opt-addon-input-${item.id}`" :value="getItemValue(item) ?? ''" class="ss-input"
                            style="width: 150px"
                            type="text" @input="onInputChange($event, item)">
                    </template>
                    <template v-else-if="item.type === 'password'">
                        <font-awesome-icon
                            :icon="item.icon || ['fas', 'key']" />
                        <div>
                            <label :for="`opt-addon-password-${item.id}`">{{ item.label }}</label>
                            <span v-if="item.description">{{ item.description }}</span>
                        </div>
                        <input :id="`opt-addon-password-${item.id}`" :value="getItemValue(item) ?? ''" class="ss-input"
                            style="width: 150px"
                            type="password" @input="onInputChange($event, item)">
                    </template>
                    <template v-else-if="item.type === 'select'">
                        <font-awesome-icon v-if="item.icon" :icon="item.icon" />
                        <div v-if="item.label || item.description">
                            <label v-if="item.label" :for="`opt-addon-select-${item.id}`">{{ item.label }}</label>
                            <span v-if="item.description">{{ item.description }}</span>
                        </div>
                        <div class="select-wrapper">
                            <select
                                :id="`opt-addon-select-${item.id}`"
                                :value="getItemValue(item) ?? (item.options?.[0]?.value ?? '')"
                                @change="onSelectChange($event, item)">
                                <option
                                    v-for="opt in item.options || []"
                                    :key="String(opt.value)"
                                    :value="opt.value">
                                    {{ opt.label }}
                                </option>
                            </select>
                        </div>
                    </template>
                    <template v-else-if="item.type === 'button'">
                        <font-awesome-icon v-if="item.icon" :icon="item.icon" />
                        <div v-if="item.label || item.description">
                            <span v-if="item.label">{{ item.label }}</span>
                            <span v-if="item.description">{{ item.description }}</span>
                        </div>
                        <button class="ss-button" style="width: 100px; font-size: 0.8rem" @click="onClickButton(item)">
                            {{ item.label }}
                        </button>
                    </template>
                </div>
                </div>
            </div>
        </template>
        <template v-else>
            <div class="opt-group">
                <header class="opt-group-title">{{ $t('插件') }}</header>
                <div class="opt-group-card empty">
                <span>{{ $t('暂无附加设置') }}</span>
                <span>{{ $t('附加设置由主题或其他插件注册，当前没有可用项。') }}</span>
                <span>{{ $t('部分设置会在对应功能首次使用后出现。') }}</span>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
    import { i18n } from '@chihiro/im-native/host'
    import { useSettingsStore } from '@renderer/state/settings'
    import {
        extraOptionCards,
        runAS,
        type ExtraOptionItem,
    } from '@renderer/function/option'

    defineOptions({ name: 'UserOptAddon' })

    const $t = i18n.global.t
    const settingsStore = useSettingsStore()

    const cards = extraOptionCards

    function getItemValue(item: ExtraOptionItem): any {
        const key = item.optionKey
        if (key && settingsStore.sysConfig &&
            Object.prototype.hasOwnProperty.call(settingsStore.sysConfig, key)) {
            return (settingsStore.sysConfig as any)[key]
        }
        return item.defaultValue
    }

    function handleChange(item: ExtraOptionItem, value: any) {
        if (item.optionKey) {
            runAS(item.optionKey, value)
        }
        if (typeof item.callback === 'function') {
            try {
                item.callback(value)
            } catch (e) {
                // 回调异常不影响主流程
                // eslint-disable-next-line no-console
                console.error('extra option callback error:', e)
            }
        }
    }

    function onSwitchChange(event: Event, item: ExtraOptionItem) {
        const sender = event.target as HTMLInputElement
        handleChange(item, sender.checked)
    }

    function onInputChange(event: Event, item: ExtraOptionItem) {
        const sender = event.target as HTMLInputElement
        handleChange(item, sender.value)
    }

    function onSelectChange(event: Event, item: ExtraOptionItem) {
        const sender = event.target as HTMLSelectElement
        handleChange(item, sender.value)
    }

    function onClickButton(item: ExtraOptionItem) {
        if (typeof item.callback === 'function') {
            try {
                item.callback(getItemValue(item))
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error('extra option button callback error:', e)
            }
        }
    }
</script>
<style scoped>
.empty {
    margin: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
}
.empty svg {
    display: none;
}
.empty span {
    color: var(--color-font-2);
    margin: 0;
    font-size: 0.75rem;
    line-height: 1.45;
    text-align: center;
}
.empty span:first-child {
    color: var(--color-font);
    margin-bottom: 4px;
    font-size: 0.88rem;
    font-weight: 500;
}
.empty a {
    color: var(--color-font-2);
    font-size: 0.75rem;
    text-decoration: none;
}
</style>
