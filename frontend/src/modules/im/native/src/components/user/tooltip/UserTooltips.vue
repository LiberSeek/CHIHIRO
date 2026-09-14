<template>
    <Teleport to="#chihiro-im-overlays">
        <TransitionGroup name="tooltip">
            <Tooltip v-for="data in tooltipList" :key="data.id"
                v-bind="data"
                v-model="data.compData.model" />
        </TransitionGroup>
    </Teleport>
</template>

<script setup lang="ts">
import { tooltipList } from '@renderer/function/tooltip'
import Tooltip from './UserTooltip.vue'
</script>
