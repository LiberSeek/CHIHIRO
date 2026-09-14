import type { InjectionKey } from 'vue'
import { AccountSessionManager } from './account-session-manager'
import { oneBotAccountConnector } from './onebot-account-connector'

/** One transport owner for the whole Chihiro frontend. */
export const accountSessionManagerKey: InjectionKey<AccountSessionManager> = Symbol('account-session-manager')
export function createAccountSessionManager(): AccountSessionManager {
  return new AccountSessionManager(oneBotAccountConnector)
}
