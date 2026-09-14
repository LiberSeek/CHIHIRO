export type ThemeMode = 'light' | 'dark' | 'system'

export const THEME_KEY = 'chihiro-theme'
export const AGENT_THEME_KEY = 'themeMode'
export const AGENT_UI_THEME_KEY = 'uiTheme'
export const THEME_MODES: ThemeMode[] = ['light', 'dark', 'system']

type ResolvedTheme = 'light' | 'dark'
type ThemeListener = (mode: ThemeMode, resolved: ResolvedTheme) => void

const listeners = new Set<ThemeListener>()

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function media(): MediaQueryList | null {
  try {
    return typeof window === 'undefined' ? null : window.matchMedia('(prefers-color-scheme: dark)')
  } catch {
    return null
  }
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function readThemeMode(): ThemeMode {
  const store = storage()
  const chihiro = store?.getItem(THEME_KEY)
  if (isThemeMode(chihiro)) return chihiro
  const agent = store?.getItem(AGENT_THEME_KEY)
  if (isThemeMode(agent)) return agent
  const uiTheme = store?.getItem(AGENT_UI_THEME_KEY)
  if (uiTheme === 'PurpleThemeDark') return 'dark'
  if (uiTheme === 'PurpleTheme') return 'light'
  return 'dark'
}

export function resolveTheme(mode: ThemeMode = readThemeMode()): ResolvedTheme {
  if (mode === 'system') return media()?.matches ? 'dark' : 'light'
  return mode
}

export function uiThemeFor(resolved: ResolvedTheme): 'PurpleTheme' | 'PurpleThemeDark' {
  return resolved === 'dark' ? 'PurpleThemeDark' : 'PurpleTheme'
}

export function onThemeChange(listener: ThemeListener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function applyTheme(mode: ThemeMode) {
  const next = isThemeMode(mode) ? mode : 'dark'
  const resolved = resolveTheme(next)
  const uiTheme = uiThemeFor(resolved)
  const store = storage()
  store?.setItem(THEME_KEY, next)
  store?.setItem(AGENT_THEME_KEY, next)
  store?.setItem(AGENT_UI_THEME_KEY, uiTheme)
  const root = typeof document === 'undefined' ? null : document.documentElement
  if (root) {
    root.dataset.theme = resolved
    root.dataset.themeMode = next
    root.classList.toggle('bp-dark', resolved === 'dark')
    root.classList.toggle('bp-light', resolved === 'light')
  }
  if (typeof document !== 'undefined') {
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', resolved === 'dark' ? '#1c1c1e' : '#f2f2f7')
  }
  for (const listener of listeners) listener(next, resolved)
  return { mode: next, resolved, uiTheme }
}

export function cycleTheme() {
  const current = readThemeMode()
  return applyTheme(THEME_MODES[(THEME_MODES.indexOf(current) + 1) % THEME_MODES.length])
}

let watchingSystem = false
export function watchSystemTheme() {
  if (watchingSystem) return
  const query = media()
  if (!query) return
  watchingSystem = true
  query.addEventListener('change', () => {
    if (readThemeMode() === 'system') applyTheme('system')
  })
}
