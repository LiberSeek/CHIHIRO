<script setup lang="ts">
import { inject, onMounted, ref, shallowRef, type Component } from 'vue'
import { imLoaderKey } from './loader'
const loader = inject(imLoaderKey)!
const component = shallowRef<Component>()
const error = ref('')
async function load() {
  error.value = ''
  try { component.value = await loader() }
  catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
}
onMounted(load)
</script>
<template>
  <component :is="component" v-if="component" />
  <div v-else-if="error" role="alert">{{ error }} <button type="button" @click="load">重试</button></div>
  <div v-else role="status">正在加载消息…</div>
</template>
