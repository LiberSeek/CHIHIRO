import { describe, expect, it, vi } from 'vitest'
import {
    captureNativeAccountGeneration,
    invalidateNativeAccountGeneration,
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
})
