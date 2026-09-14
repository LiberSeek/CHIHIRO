import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import { useShellStore } from '@/stores/shell'
import { createCustomerClient, type CustomerDetail, type CustomerPatch, type CustomerSummary } from './customer-client'

function message(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}

function isAbort(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === 'AbortError'
}

export const useCustomerStore = defineStore('customers', () => {
  const shell = useShellStore()
  const client = createCustomerClient()
  const customers = ref<CustomerSummary[]>([])
  const total = ref(0)
  const query = ref('')
  const selectedId = ref('')
  const customer = ref<CustomerDetail | null>(null)
  const listLoading = ref(false)
  const detailLoading = ref(false)
  const saving = ref(false)
  const listError = ref('')
  const detailError = ref('')
  const saveError = ref('')
  const activeAccountId = computed(() => shell.activeAccountId)
  let listVersion = 0
  let detailVersion = 0
  let saveVersion = 0
  let listController: AbortController | undefined
  let detailController: AbortController | undefined
  let saveController: AbortController | undefined

  function clear() {
    ++listVersion; ++detailVersion; ++saveVersion
    listController?.abort(); detailController?.abort(); saveController?.abort()
    listController = undefined; detailController = undefined; saveController = undefined
    customers.value = []; total.value = 0; selectedId.value = ''; customer.value = null
    listLoading.value = false; detailLoading.value = false; saving.value = false
    listError.value = ''; detailError.value = ''; saveError.value = ''
  }

  async function loadList(nextQuery = query.value) {
    const accountId = activeAccountId.value
    query.value = nextQuery
    const version = ++listVersion
    listController?.abort()
    if (!accountId) {
      customers.value = []; total.value = 0; selectedId.value = ''; customer.value = null
      listLoading.value = false; listError.value = ''
      return
    }
    const controller = new AbortController()
    listController = controller
    listLoading.value = true; listError.value = ''
    try {
      const result = await client.list(accountId, nextQuery, controller.signal)
      if (version !== listVersion || controller.signal.aborted || accountId !== activeAccountId.value) return
      customers.value = result.customers
      total.value = result.total
      if (selectedId.value && !result.customers.some(item => item.id === selectedId.value)) {
        selectedId.value = ''; customer.value = null
      }
    } catch (cause) {
      if (version === listVersion && !controller.signal.aborted && !isAbort(cause)) listError.value = message(cause, '无法加载客户资料')
    } finally {
      if (version === listVersion) { listLoading.value = false; listController = undefined }
    }
  }

  async function select(id: string) {
    const accountId = activeAccountId.value
    const version = ++detailVersion
    detailController?.abort()
    selectedId.value = id
    customer.value = null
    detailError.value = ''
    if (!accountId || !id) { detailLoading.value = false; return }
    const controller = new AbortController()
    detailController = controller
    detailLoading.value = true
    try {
      const result = await client.get(accountId, id, controller.signal)
      if (version !== detailVersion || controller.signal.aborted || accountId !== activeAccountId.value || id !== selectedId.value) return
      customer.value = result
    } catch (cause) {
      if (version === detailVersion && !controller.signal.aborted && !isAbort(cause)) detailError.value = message(cause, '无法加载客户详情')
    } finally {
      if (version === detailVersion) { detailLoading.value = false; detailController = undefined }
    }
  }

  async function save(patch: CustomerPatch) {
    const accountId = activeAccountId.value
    const id = selectedId.value
    if (!accountId || !id || !customer.value || saving.value) return
    const version = ++saveVersion
    saveController?.abort()
    const controller = new AbortController()
    saveController = controller
    saving.value = true; saveError.value = ''
    try {
      const result = await client.update(accountId, id, patch, controller.signal)
      if (version !== saveVersion || controller.signal.aborted || accountId !== activeAccountId.value || id !== selectedId.value) return
      customer.value = result
      customers.value = customers.value.map(item => item.id === id ? { ...item, ...result } : item)
    } catch (cause) {
      if (version === saveVersion && !controller.signal.aborted && !isAbort(cause)) saveError.value = message(cause, '无法保存客户资料')
    } finally {
      if (version === saveVersion) { saving.value = false; saveController = undefined }
    }
  }

  watch(activeAccountId, () => { clear(); void loadList() }, { immediate: true, flush: 'sync' })
  return { activeAccountId, customers, total, query, selectedId, customer, listLoading, detailLoading, saving, listError, detailError, saveError, loadList, select, save, clear }
})
