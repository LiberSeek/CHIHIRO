import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const { settings } = vi.hoisted(() => ({
    settings: { sysConfig: { use_favicon_notice: false } },
}))

vi.mock('@renderer/state/settings', () => ({
    useSettingsStore: () => settings,
}))
vi.mock('@renderer/state/contact', () => ({
    useContactStore: () => ({ onMsgList: [] }),
}))

import { refreshFavicon } from './src/function/favicon'

beforeEach(() => {
    settings.sysConfig.use_favicon_notice = false
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

it('preserves the Chihiro product favicon when IM notification badges are disabled', () => {
    const readComputedStyle = vi.fn()
    vi.stubGlobal('getComputedStyle', readComputedStyle)

    refreshFavicon()
    vi.advanceTimersByTime(500)

    expect(readComputedStyle).not.toHaveBeenCalled()
})
