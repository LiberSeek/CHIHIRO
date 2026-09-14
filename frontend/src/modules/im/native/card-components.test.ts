import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

vi.mock('./src/function/base', () => ({ Logger: class { error = vi.fn() } }))
vi.mock('./src/function/utils/appUtil', () => ({ openLink: vi.fn() }))
vi.mock('./src/function/utils/msgUtil', () => ({ sendMsgRaw: vi.fn() }))
vi.mock('./src/function/utils/systemUtil', () => ({ getForegroundToneGridFromImageUrl: vi.fn() }))
vi.mock('./src/runtime/backend', () => ({ backend: { proxyUrl: (url: string) => url } }))
vi.mock('./src/state/chat', () => ({ useChatStore: () => ({ chatInfo: { show: {} } }) }))
vi.mock('./src/function/model/img', () => ({ Img: class {} }))
vi.mock('./src/components/user/UserViewerCom.vue', () => ({ default: { render: () => null } }))
vi.mock('./src/components/user/UserMusicPlayer.vue', () => ({ addMusic: vi.fn() }))
vi.mock('@vuemap/vue-amap', () => ({ ElAmap: { render: () => null }, ElAmapMarker: { render: () => null } }))

import UserJsonSegComp from './src/components/user/UserJsonSegComp.vue'
import { cardComponents } from './card-components'
import { getForegroundToneGridFromImageUrl } from './src/function/utils/systemUtil'

function renderCard(data: string) {
  const app = createSSRApp({ render: () => h(UserJsonSegComp, { data }) })
  app.config.globalProperties.$t = (key: string) => key
  app.component('font-awesome-icon', { render: () => null })
  return renderToString(app)
}

describe('native JSON card renderers', () => {
  it('includes the ten original card implementations in the module graph', () => {
    expect(Object.keys(cardComponents).sort()).toEqual([
      'com.tencent.autoreply', 'com.tencent.contact.lua', 'com.tencent.feed.lua',
      'com.tencent.forum', 'com.tencent.mannounce', 'com.tencent.map',
      'com.tencent.miniapp.lua', 'com.tencent.miniapp_01', 'com.tencent.music.lua',
      'com.tencent.tuwen.lua',
    ].sort())
    expect(Object.values(cardComponents).every(component => typeof component === 'object')).toBe(true)
  })

  it('renders the original miniapp invitation schema', async () => {
    const html = await renderCard(JSON.stringify({
      app: 'com.tencent.miniapp_01', meta: { invitation_1: {
        title: 'Invitation', name: 'Workshop', icon: '/icon.png', imageUrl: '/preview.png',
      } },
    }))
    expect(html).toContain('Invitation')
    expect(html).toContain('Workshop')
    expect(html).toContain('/preview.png')
    expect(html).not.toContain('msg-unknown')
  })

  it('does not load a cover when a music payload fails schema validation', async () => {
    const html = await renderCard(JSON.stringify({ app: 'com.tencent.music.lua', meta: {} }))
    expect(html).toContain('加载失败')
    expect(getForegroundToneGridFromImageUrl).not.toHaveBeenCalled()
  })

  it.each(['{', '{"app":"unknown"}', '{"app":"constructor"}'])(
    'renders unsupported payloads without mounting an unrelated component: %s', async data => {
      expect(await renderCard(data)).toContain('msg-unknown')
    },
  )
})
