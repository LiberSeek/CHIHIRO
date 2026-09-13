import { defineStore } from 'pinia'

import type { AccountContext, AccountId } from '@/contracts'
import { accountId } from '@/contracts'

export const useShellStore = defineStore('shell', {
  state: () => ({
    activeAccountId: null as AccountId | null,
    accounts: [] as AccountContext[],
    loading: false,
  }),
  actions: {
    selectAccount(accountId: AccountId | null) {
      this.activeAccountId = accountId
    },
    async refreshAccounts() {
      this.loading = true
      try {
        const response = await fetch('/api/runtime/state')
        if (!response.ok) throw new Error(`runtime_state_${response.status}`)
        const state = await response.json() as { accounts?: { accounts?: Array<Record<string, unknown>>, activeId?: string | null } }
        this.accounts = (state.accounts?.accounts ?? []).map((item) => ({
          id: accountId(String(item.id ?? item.uin ?? 'unknown')),
          label: String(item.label ?? item.nickname ?? item.id ?? item.uin ?? 'QQ'),
          platform: 'qq',
          status: item.status === 'online' ? 'online' : item.status === 'connecting' ? 'connecting' : 'offline',
        }))
        this.activeAccountId = state.accounts?.activeId ? accountId(state.accounts.activeId) : this.accounts[0]?.id ?? null
      } finally {
        this.loading = false
      }
    },
  },
})
