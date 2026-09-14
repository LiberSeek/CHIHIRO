/*
 * Chihiro account-session facade for the extracted Stapxs Connector API.
 * Transport and credentials are owned by the unified host and Gateway.
 */
import { reactive } from 'vue'
import type { AccountSession } from '@/services/account-session-manager'
import { AccountSessionSupersededError } from '@/services/account-session-manager'
import { NativeAccountBinding } from '../../account-binding'
import { Logger, PopInfo, PopType } from './base'
import { dispatch } from './msg'
import { getMsgData } from './utils/msgUtil'
import { useAuthStore } from '@renderer/state/auth'
import { useConnectionStore } from '@renderer/state/connection'
import type { LoginCacheElem, ConnectionHistoryItem } from './elements/system'

const logger = new Logger()
let binding: NativeAccountBinding | undefined
let disconnect: (() => void) | undefined

function report(error: unknown) {
    logger.error(error instanceof Error ? error : null, 'OneBot request failed')
    new PopInfo().add(PopType.ERR, error instanceof Error ? error.message : 'OneBot request failed')
}

function resetConnection() {
    const store = useConnectionStore()
    if (store.metaEventWatchTimer) clearTimeout(store.metaEventWatchTimer)
    store.metaEventWatchTimer = undefined
    store.metaEventTimeoutTriggered = false
    login.creating = false
    login.status = false
}

export class Connector {
    static bind(session: AccountSession, onDisconnect: () => void): () => void {
        this.unbind()
        disconnect = onDisconnect
        login.address = `/i/${encodeURIComponent(session.accountId)}/onebot-ws`
        login.token = ''
        const current = new NativeAccountBinding(session, {
            dispatch: (payload, echo) => dispatch(payload as Record<string, unknown>, echo),
            error: report,
            closed: () => {
                if (binding !== current) return
                this.unbind()
                onDisconnect()
            },
        })
        binding = current
        return () => { if (binding === current) this.unbind() }
    }

    static unbind() {
        binding?.invalidate()
        binding = undefined
        disconnect = undefined
        resetConnection()
    }

    static start() {
        if (!binding?.valid) throw new Error('Native IM has no account session')
        login.creating = true
        this.send('get_version_info', {}, 'getVersionInfo')
    }

    static close() {
        const notify = disconnect
        this.unbind()
        notify?.()
    }

    static forceDisconnect(reason: string) {
        report(new Error(reason))
        this.close()
    }

    // Retained desktop event entrypoints cannot create a second transport.
    static onopen(_address: string, _token?: string) { this.start() }
    static onmessage(_message: string) { /* Events arrive only through the bound session. */ }
    static onclose(_code: number, _message?: string, _address?: string, _token?: string) { this.close() }

    static async callApi(api: string, args: Record<string, unknown>): Promise<any> {
        const current = binding
        if (!current?.valid) throw new Error('Native IM has no account session')
        const map = useAuthStore().jsonMap?.[api]
        if (!map) return undefined
        try {
            const response = await current.request(map.name, args)
            if (binding !== current) throw new AccountSessionSupersededError(current.accountId)
            return getMsgData(api, response, map)
        } catch (error) {
            // Propagate invalidation so an awaiting component cannot act on a stale result.
            if (error instanceof AccountSessionSupersededError || !current.valid) throw error
            report(error)
            return null
        }
    }

    static send(name: string, params: Record<string, unknown>, echo = name) {
        if (!binding?.valid) return
        binding.send(name, params, echo)
    }

    static sendRaw(name: string, params: Record<string, unknown>, echo = name) {
        this.send(name, params, echo.startsWith('send_') ? echo.slice(5) : echo)
    }

    static sendRawJson(source: string) {
        const data = JSON.parse(source)
        if (typeof data.action !== 'string') throw new Error('Invalid OneBot action')
        this.sendRaw(data.action, data.params ?? {}, data.echo ?? data.action)
    }
}

export const login: LoginCacheElem = reactive({
    quickLogin: [], status: false, address: '', token: '', creating: false, connectionHistory: [],
})

// Native login completion retains account labels in memory, never endpoint credentials.
export function saveConnectionToHistory(_address: string, _token: string, uin?: string, nickname?: string) {
    if (!binding?.valid) return
    const item: ConnectionHistoryItem = {
        address: login.address, token: '', uin, nickname, lastConnected: Date.now(),
    }
    login.connectionHistory = [item]
}
