import { defineStore } from 'pinia'

import type { AccountId } from '@/contracts'

export const useShellStore = defineStore('shell', {
  state: () => ({
    activeAccountId: null as AccountId | null,
  }),
  actions: {
    selectAccount(accountId: AccountId | null) {
      this.activeAccountId = accountId
    },
  },
})
