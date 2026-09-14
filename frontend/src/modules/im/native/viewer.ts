export interface NativeViewerHost {
  close?: () => void
}

let activeViewerHost: NativeViewerHost | null = null

export function setNativeViewerHost(host: NativeViewerHost | null): () => void {
  activeViewerHost = host
  return () => {
    if (activeViewerHost === host) activeViewerHost = null
  }
}

export function closeNativeViewer(): void {
  try {
    activeViewerHost?.close?.()
  } catch (cause) {
    console.warn('[Chihiro] native viewer close failed', cause)
  }
}

export function getNativeViewerHost(): NativeViewerHost | null {
  return activeViewerHost
}
