import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const nativeRoot = new URL('.', import.meta.url)
const repoRoot = new URL('../../../../..', import.meta.url)

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) return sourceFiles(full)
    return /\.(ts|vue)$/.test(name) && !/\.test\.ts$/.test(name) ? [full] : []
  })
}

describe('agent native module boundary', () => {
  it('installs into the existing Chihiro Vue app instead of bootstrapping AstrBot Dashboard', () => {
    const runtime = readFileSync(new URL('./runtime.ts', nativeRoot), 'utf8')
    const loader = readFileSync(new URL('../loader.ts', nativeRoot), 'utf8')

    expect(runtime).toContain('export function installAgentNative(app: App')
    expect(runtime).toContain('app.use(createAgentVuetify())')
    expect(loader).toContain('installAgentNative(app, { hosted: true, gatewayBase: \'/astrbot\' })')
    expect(runtime).not.toContain('createApp')
    expect(loader).not.toContain('createApp')
  })

  it('keeps Dashboard-only pages behind the external settings surface', () => {
    const navigation = readFileSync(new URL('./src/navigation.ts', nativeRoot), 'utf8')

    expect(navigation).toContain("openExternalSettings({ title: 'AstrBot 设置', src: '/astrbot/#/settings' })")
    expect(navigation).toContain("openExternalSettings({ title: 'AstrBot 知识库', src: '/astrbot/#/knowledge-base' })")
    expect(navigation).not.toContain("router.push('/astrbot")
    expect(navigation).not.toContain('FullLayout')
  })

  it('does not import AstrBot app bootstrap, Dashboard layouts, or runtime script mounts', () => {
    const files = sourceFiles(new URL('.', nativeRoot).pathname)
    const violations = files.flatMap(file => {
      const rel = relative(new URL('.', repoRoot).pathname, file)
      const source = readFileSync(file, 'utf8')
      const patterns: Array<[RegExp, string]> = [
        [/\bcreateApp\s*\(/, 'createApp bootstrap'],
        [/from\s+['"][^'"]*(?:@\/router|\.\.\/router|layouts\/FullLayout|layouts\/user|FullLayout\.vue|main\.(?:ts|js)|App\.vue)['"]/, 'Dashboard bootstrap/router/layout import'],
        [/ChihiroChatUI\.mount|createElement\(['"]script['"]\)|appendChild\([^\n]*script/, 'runtime script mount'],
        [/<(?:iframe|component)[^>]+src=["']\/astrbot\b/, 'full AstrBot iframe'],
      ]
      return patterns.filter(([pattern]) => pattern.test(source)).map(([, label]) => `${rel}: ${label}`)
    })

    expect(violations).toEqual([])
  })
})
