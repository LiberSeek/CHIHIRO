import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { AGENT_THEME_KEY, AGENT_UI_THEME_KEY, THEME_KEY, applyTheme, cycleTheme, onThemeChange, readThemeMode, resolveTheme, uiThemeFor } from './theme'

function installDom(prefersDark = true) {
  const store = new Map<string, string>()
  const classNames = new Set<string>()
  const dataset: Record<string, string> = {}
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, String(value)) },
    removeItem: (key: string) => { store.delete(key) },
  })
  vi.stubGlobal('document', {
    documentElement: {
      dataset,
      classList: {
        toggle(name: string, force?: boolean) {
          if (force) classNames.add(name)
          else classNames.delete(name)
        },
      },
    },
    querySelector: () => null,
  })
  vi.stubGlobal('window', {
    matchMedia: () => ({ matches: prefersDark, addEventListener() {}, removeEventListener() {} }),
  })
  return { store, classNames, dataset }
}

describe('shared shell theme', () => {
  beforeEach(() => {
    installDom(true)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('prefers chihiro-theme over the agent keys and defaults to dark', () => {
    expect(readThemeMode()).toBe('dark')
    localStorage.setItem(AGENT_THEME_KEY, 'system')
    expect(readThemeMode()).toBe('system')
    localStorage.setItem(THEME_KEY, 'light')
    expect(readThemeMode()).toBe('light')
  })

  it('writes shell, agent, and document theme together', () => {
    const applied = applyTheme('light')
    expect(applied).toEqual({ mode: 'light', resolved: 'light', uiTheme: 'PurpleTheme' })
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
    expect(localStorage.getItem(AGENT_THEME_KEY)).toBe('light')
    expect(localStorage.getItem(AGENT_UI_THEME_KEY)).toBe('PurpleTheme')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.dataset.themeMode).toBe('light')
  })

  it('resolves system mode from the OS preference', () => {
    expect(resolveTheme('system')).toBe('dark')
    expect(uiThemeFor('dark')).toBe('PurpleThemeDark')
    applyTheme('system')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.dataset.themeMode).toBe('system')
  })

  it('notifies listeners and cycles light → dark → system', () => {
    const seen: string[] = []
    const stop = onThemeChange(mode => { seen.push(mode) })
    applyTheme('light')
    expect(cycleTheme().mode).toBe('dark')
    expect(cycleTheme().mode).toBe('system')
    expect(cycleTheme().mode).toBe('light')
    stop()
    applyTheme('dark')
    expect(seen).toEqual(['light', 'dark', 'system', 'light'])
  })
})

describe('agent customizer follows the shell theme', () => {
  beforeEach(() => {
    installDom(true)
    setActivePinia(createPinia())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps vuetify theme in lockstep with chihiro-theme', async () => {
    const { useCustomizerStore } = await import('./modules/agent/native/src/stores/customizer')
    const customizer = useCustomizerStore()
    applyTheme('light')
    customizer.SYNC_THEME()
    expect(customizer.themeMode).toBe('light')
    expect(customizer.uiTheme).toBe('PurpleTheme')
    customizer.SET_THEME_MODE('dark')
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
    expect(customizer.uiTheme).toBe('PurpleThemeDark')
    customizer.SET_UI_THEME('PurpleTheme')
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
