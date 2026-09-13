<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, ref, shallowRef, type Component } from 'vue'
import { agentLoaderKey } from './loader'

const loadAgent = inject(agentLoaderKey)
const component = shallowRef<Component>()
const loading = ref(false)
const error = ref('')
let active = true
async function load() {
  loading.value = true
  error.value = ''
  try {
    if (!loadAgent) throw new Error('Agent 加载服务未初始化')
    const loaded = await loadAgent()
    if (active) component.value = loaded
  } catch (reason) {
    if (active) error.value = reason instanceof Error ? reason.message : '工作台加载失败'
  } finally {
    if (active) loading.value = false
  }
}
onMounted(load)
onBeforeUnmount(() => { active = false })
</script>

<template>
  <component :is="component" v-if="component" />
  <section v-else class="agent-loading" role="status">
    <p>{{ loading ? '正在加载工作台…' : error }}</p>
    <button v-if="!loading" type="button" @click="load">重新加载</button>
  </section>
</template>

<style scoped>
.agent-loading { display: grid; align-content: center; justify-items: center; gap: 16px; height: 100%; color: #c9d8ed; }
.agent-loading button { padding: 8px 16px; border: 1px solid currentColor; border-radius: 6px; color: inherit; background: transparent; cursor: pointer; }
</style>
