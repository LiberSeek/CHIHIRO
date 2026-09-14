import { describe, expect, it, vi } from 'vitest'
import {
    captureNativeAccountGeneration,
    captureNativeAsyncScope,
    invalidateNativeAccountGeneration,
    isNativeAsyncScopeCurrent,
    isNativeAccountGenerationCurrent,
    runForNativeAccount,
} from './asyncAccountScope'

describe('native async account scope', () => {
    it('rejects delayed work captured before account invalidation', async () => {
        vi.useFakeTimers()
        const generation = captureNativeAccountGeneration()
        const mutation = vi.fn()

        setTimeout(() => runForNativeAccount(generation, mutation), 50)
        invalidateNativeAccountGeneration()
        await vi.runAllTimersAsync()

        expect(isNativeAccountGenerationCurrent(generation)).toBe(false)
        expect(mutation).not.toHaveBeenCalled()
        vi.useRealTimers()
    })

    it('allows delayed work while the account generation is unchanged', async () => {
        vi.useFakeTimers()
        const generation = captureNativeAccountGeneration()
        const mutation = vi.fn()

        setTimeout(() => runForNativeAccount(generation, mutation), 50)
        await vi.runAllTimersAsync()

        expect(mutation).toHaveBeenCalledOnce()
        vi.useRealTimers()
    })

    it('rejects work after switching conversations in the same account', () => {
        const scope = captureNativeAsyncScope('user', 100, 1)

        expect(isNativeAsyncScopeCurrent(scope, 'user', 100, 1)).toBe(true)
        expect(isNativeAsyncScopeCurrent(scope, 'group', 200, 2)).toBe(false)
    })

    it('rejects work from a previous visit to the same conversation', () => {
        const scope = captureNativeAsyncScope('user', 100, 1)

        expect(isNativeAsyncScopeCurrent(scope, 'user', 100, 2)).toBe(false)
    })
})
