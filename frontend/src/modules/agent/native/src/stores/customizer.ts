import { defineStore } from 'pinia';
import config, { type ThemeMode } from '@/modules/agent/native/src/config';
import { applyTheme, readThemeMode, resolveTheme, uiThemeFor } from '@/theme';

const DARK_THEMES: ReadonlySet<string> = new Set(['PurpleThemeDark']);

function themeState(mode: ThemeMode) {
  const resolved = resolveTheme(mode);
  return { themeMode: mode, uiTheme: uiThemeFor(resolved) };
}

export const useCustomizerStore = defineStore('customizer', {
  state: () => ({
    Sidebar_drawer: config.Sidebar_drawer,
    Customizer_drawer: config.Customizer_drawer,
    mini_sidebar: config.mini_sidebar,
    fontTheme: 'Noto Sans SC',
    uiTheme: config.uiTheme,
    themeMode: config.themeMode as ThemeMode,
    inputBg: config.inputBg,
    chatSidebarOpen: false, // chat mode mobile sidebar state
    chatSidebarCollapsed: false, // chat mode desktop sidebar state
  }),

  getters: {
    isDark: (state) => state.uiTheme ? DARK_THEMES.has(state.uiTheme) : false,
  },

  actions: {
    SET_SIDEBAR_DRAWER() {
      this.Sidebar_drawer = !this.Sidebar_drawer;
    },
    SET_MINI_SIDEBAR(payload: boolean) {
      this.mini_sidebar = payload;
    },
    SET_FONT(payload: string) {
      this.fontTheme = payload;
    },

    SET_UI_THEME(payload: string) {
      this.SET_THEME_MODE(payload === 'PurpleThemeDark' ? 'dark' : 'light');
    },

    SET_THEME_MODE(mode: ThemeMode) {
      const applied = applyTheme(mode);
      Object.assign(this, themeState(applied.mode));
    },

    SYNC_THEME() {
      Object.assign(this, themeState(readThemeMode()));
    },

    TOGGLE_CHAT_SIDEBAR() {
      this.chatSidebarOpen = !this.chatSidebarOpen;
    },
    SET_CHAT_SIDEBAR(payload: boolean) {
      this.chatSidebarOpen = payload;
    },
    SET_CHAT_SIDEBAR_COLLAPSED(payload: boolean) {
      this.chatSidebarCollapsed = payload;
    },
  },
});
