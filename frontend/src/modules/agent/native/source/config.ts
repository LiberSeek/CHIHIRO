import { readThemeMode, resolveTheme, uiThemeFor, type ThemeMode } from '@/theme';

export type { ThemeMode };

export type ConfigProps = {
  Sidebar_drawer: boolean;
  Customizer_drawer: boolean;
  mini_sidebar: boolean;
  fontTheme: string;
  uiTheme: string;
  themeMode: ThemeMode;
  inputBg: boolean;
};

export function resolveUiTheme(mode: ThemeMode): string {
  return uiThemeFor(resolveTheme(mode));
}

const themeMode = readThemeMode();
const uiTheme = resolveUiTheme(themeMode);

const config: ConfigProps = {
  Sidebar_drawer: true,
  Customizer_drawer: false,
  mini_sidebar: false,
  fontTheme: 'Roboto',
  uiTheme,
  themeMode,
  inputBg: false,
};

export default config;
