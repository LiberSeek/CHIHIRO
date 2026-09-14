import type { App } from 'vue'
import { createI18n } from 'vue-i18n'
import VueClipboard from 'vue-clipboard2'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { library } from '@fortawesome/fontawesome-svg-core'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { faSquare, faHeart } from '@fortawesome/free-regular-svg-icons'
import { configureNativeImHost, type NativeImHost, type NativeImI18n } from './host'
import { getPortableFileLang } from './src/function/utils/systemUtil'
import Option from './src/function/option'
import { useSettingsStore } from './src/state/settings'
import './src/assets/css/view.css'
import './src/assets/css/chat.css'
import './src/assets/css/msg.css'
import './src/assets/css/options.css'
import './src/assets/css/sys_notice.css'
import './src/assets/css/user.css'

const installed = new WeakMap<App, Promise<void>>()
export function installNativeIm(app: App, navigate: NativeImHost['navigate']): Promise<void> {
  const existing = installed.get(app)
  if (existing) return existing
  const pending = (async () => {
    const i18n = createI18n({ legacy: false, locale: 'zh-CN', fallbackLocale: 'zh-CN',
      missingWarn: false, fallbackWarn: false,
      messages: { 'zh-CN': getPortableFileLang('zh-CN') },
    })
    configureNativeImHost({
      i18n: i18n as unknown as NativeImI18n,
      copyText: value => navigator.clipboard.writeText(value),
      navigate,
    })
    app.use(i18n).use(VueClipboard)
    library.add(fas, faSquare, faHeart)
    app.component('FontAwesomeIcon', FontAwesomeIcon)
    const settings = useSettingsStore()
    Object.assign(settings.sysConfig, await Option.load())
    settings.sysConfig.open_ga_bot = false
    settings.sysConfig.close_ga = true
    settings.sysConfig.use_favicon_notice = false
    settings.firstLoad = true
  })()
  installed.set(app, pending)
  return pending
}
