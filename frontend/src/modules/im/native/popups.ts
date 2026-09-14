import { useUIStore } from './src/state/ui'

export function clearNativePopups(): void {
  const ui = useUIStore()
  if (ui.popBoxList.length === 0) return

  const popups = [...ui.popBoxList]
  ui.popBoxList = []

  for (const popup of popups) {
    try {
      popup.onClose?.()
    } catch (cause) {
      console.warn('[Chihiro] native popup onClose failed', cause)
    }
  }
}
