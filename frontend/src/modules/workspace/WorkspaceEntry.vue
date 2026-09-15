<script setup lang="ts">
import { inject, onMounted, ref, shallowRef, type Component } from 'vue'
import { recoverStaleChunk } from '@/app/stale-chunk'
import { workspaceLoaderKey } from './loader'
const loader = inject(workspaceLoaderKey)!
const component = shallowRef<Component>()
const error = ref('')
async function load() {
  error.value = ''
  try { component.value = await loader() }
  catch (cause) {
    recoverStaleChunk(cause)
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}
onMounted(load)
</script>
<template>
  <component :is="component" v-if="component" />
  <div v-else-if="error" class="app-loading" role="alert">
    <p>{{ error }}</p>
    <button type="button" @click="load">重试</button>
  </div>
  <div v-else class="app-loading" role="status">
    <span class="app-loading-spinner" aria-hidden="true" />
    <p>加载中…</p>
  </div>
</template>
