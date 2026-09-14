import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { clearNativePopups } from './popups'
import { useUIStore } from './src/state/ui'

vi.mock('./src/function/utils/systemUtil', () => ({
  getInch: vi.fn(() => 1),
}))

describe('clearNativePopups', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('clears all native modal popups and runs close hooks', () => {
    const firstClose = vi.fn()
    const secondClose = vi.fn()
    const ui = useUIStore()
    ui.popBoxList = [
      { title: '转发消息', onClose: firstClose },
      { title: '提醒', onClose: secondClose },
    ]

    clearNativePopups()

    expect(ui.popBoxList).toEqual([])
    expect(firstClose).toHaveBeenCalledOnce()
    expect(secondClose).toHaveBeenCalledOnce()
  })
})
