import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import { PurpleThemeDark } from './src/theme/DarkTheme'
import { PurpleTheme } from './src/theme/LightTheme'

export function createAgentVuetify() {
  return createVuetify({
    components,
    directives,
    theme: {
      defaultTheme: 'PurpleTheme',
      themes: { PurpleTheme, PurpleThemeDark },
    },
    defaults: {
      VCard: { rounded: 'lg' },
      VSnackbar: { elevation: 6, rounded: 'lg' },
      VTextField: { rounded: 'lg' },
      VTooltip: { location: 'top' },
    },
  })
}
