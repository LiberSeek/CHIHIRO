import { readFileSync } from 'node:fs'
import postcss from 'postcss'
import { describe, expect, it } from 'vitest'
import config from '../../../../vite.config'

describe('native IM theme isolation', () => {
  it('preserves document theme classes while scoping solid surface tokens', async () => {
    const css = readFileSync(new URL('./src/assets/css/user.css', import.meta.url), 'utf8')
    const plugins = (config as any).css.postcss.plugins
    const result = await postcss(plugins).process(css, {
      from: '/frontend/src/modules/im/native/src/assets/css/user.css',
    })
    expect(result.css).toContain('html.bp-dark :where(.chihiro-native-im, #chihiro-im-overlays)')
    expect(result.css).toContain('html.bp-light :where(.chihiro-native-im, #chihiro-im-overlays)')
    expect(result.css).toContain(':root[data-theme="dark"] :where(.chihiro-native-im, #chihiro-im-overlays)')
    expect(result.css).toContain(':root[data-theme="light"] :where(.chihiro-native-im, #chihiro-im-overlays)')
    expect(result.css).toContain(':where(.chihiro-native-im, #chihiro-im-overlays) {')
    expect(result.css).not.toContain('#chihiro-im-overlays).bp-dark')
    expect(result.css).not.toContain(':where(.chihiro-native-im, #chihiro-im-overlays) :root')
    expect(result.css).toContain('--color-card: #2c2c2e')
    expect(result.css).toContain('--color-card: #ffffff')
  })
})
