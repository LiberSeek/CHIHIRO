import { inject } from 'vue'

export type ConfirmDialogOptions = {
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
}

export type ConfirmDialogHandler = (options: ConfirmDialogOptions) => Promise<boolean>

export type ConfirmDialogCandidate = ConfirmDialogHandler | null | undefined

export function useConfirmDialog(): ConfirmDialogHandler | undefined {
  return inject<ConfirmDialogHandler | undefined>('$confirm', undefined)
}

export async function askForConfirmation(
  message: string,
  candidate?: ConfirmDialogCandidate,
  extras?: Omit<ConfirmDialogOptions, 'message'>
): Promise<boolean> {
  const confirmDialog = candidate ?? undefined

  if (confirmDialog) {
    try {
      return await confirmDialog({ message, ...extras })
    } catch {
      return false
    }
  }

  return window.confirm([extras?.title, message].filter(Boolean).join('\n\n'))
}
