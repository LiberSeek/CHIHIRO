<!--
 * @FileDescription: 卡片消息消息组件
 * @Author: Stapxs
 * @Date: 2023/05/23
 *        2026/02/13
 * @Version: 1.0 - 初始版本
 *           2.0 - 重构为单独组件
-->

<template>
    <template v-if="comp">
        <component :is="comp" :key="data" :id="id" :data="data" />
    </template>
    <span v-else class="msg-unknown">{{
        '( ' + $t('不支持的卡片类型') + ': ' + id + ' )'
    }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { cardComponents } from '../../../card-components'

const { data } = defineProps<{
    data: string,
}>()

const id = computed(() => {
    try {
        const json = JSON.parse(data)
        return json && typeof json.app === 'string' ? json.app : ''
    } catch {
        return ''
    }
})

const comp = computed(() => Object.hasOwn(cardComponents, id.value) ? cardComponents[id.value] : undefined)
</script>
