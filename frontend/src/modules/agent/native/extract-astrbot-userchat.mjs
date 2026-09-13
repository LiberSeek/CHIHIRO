#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleRoot = dirname(fileURLToPath(import.meta.url))
const sourceRoot = resolve(
  process.argv[2] || join(moduleRoot, '../../../../../../vendor/astrbot/dashboard/src'),
)
const entry = join(sourceRoot, 'components/user/UserChat.vue')
const supplementalEntries = [
  'theme/LightTheme.ts',
  'theme/DarkTheme.ts',
  'types/themeTypes/ThemeType.ts',
]
const sourceOutputRoot = join(moduleRoot, 'source')
const sourcePrefix = '@/modules/agent/native/source/'
const extensions = ['', '.ts', '.js', '.mjs', '.vue', '.json', '.scss', '.css']
const visited = new Set()
const dependencies = new Set()
const unresolved = new Set()

if (!existsSync(entry)) {
  throw new Error(`AstrBot UserChat source not found: ${entry}`)
}

function resolveLocalImport(specifier, importer) {
  const candidate = specifier.startsWith('@/')
    ? join(sourceRoot, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(importer), specifier)
      : null

  if (!candidate) return null

  for (const extension of extensions) {
    const file = candidate + extension
    if (existsSync(file) && statSync(file).isFile()) return file
  }

  for (const extension of ['.ts', '.js', '.mjs', '.vue']) {
    const file = join(candidate, `index${extension}`)
    if (existsSync(file) && statSync(file).isFile()) return file
  }

  return undefined
}

function visit(file) {
  if (visited.has(file)) return
  visited.add(file)

  const source = readFileSync(file, 'utf8')
  const specifiers = []
  const patterns = [
    /\bimport\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+(?:\*|\{[\s\S]*?\})\s+from\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(source))) specifiers.push(match[1])
  }

  for (const specifier of specifiers) {
    if (!specifier.startsWith('@/') && !specifier.startsWith('.')) {
      dependencies.add(specifier)
      continue
    }

    const importedFile = resolveLocalImport(specifier, file)
    if (importedFile) visit(importedFile)
    else unresolved.add(`${relative(sourceRoot, file)} -> ${specifier}`)
  }
}

visit(entry)
for (const supplementalEntry of supplementalEntries) {
  visit(join(sourceRoot, supplementalEntry))
}

if (unresolved.size) {
  throw new Error(`Unresolved local imports:\n${[...unresolved].sort().join('\n')}`)
}

function adaptSource(sourcePath, source) {
  let adapted = source.replaceAll('@/', sourcePrefix)

  if (sourcePath === 'api/http.ts') {
    adapted = readFileSync(join(moduleRoot, 'adaptations/api-http.ts'), 'utf8')
  }

  if (sourcePath === 'api/v1.ts') {
    adapted = adapted
      .replace(
        "import { apiV1Client, fetchWithAuth, httpClient } from './http';",
        "import { apiV1Client, configureHttpClient, fetchWithAuth, httpClient, isHosted } from './http';",
      )
      .replace(
        "const apiPrefix = () => Boolean((globalThis as any).__CHIHIRO_CHATUI_HOSTED__)\n  ? '/astrbot/api/v1'\n  : '/api/v1';",
        "const apiPrefix = () => isHosted() ? '/astrbot/api/v1' : '/api/v1';",
      )
      .replace(
        "  (globalThis as any).__CHIHIRO_CHATUI_HOSTED__ = hosted;\n  apiV1Client.defaults.baseURL = hosted ? '/astrbot/api/v1' : '/api/v1';",
        '  configureHttpClient(hosted);',
      )
      .replace(
        'configureApiBase(Boolean((globalThis as any).__CHIHIRO_CHATUI_HOSTED__));',
        'configureApiBase(false);',
      )
      .replaceAll("(globalThis as any).__CHIHIRO_CHATUI_HOSTED__ ? '' : token", "isHosted() ? '' : token")
  }

  if (sourcePath === 'components/user/UserChat.vue') {
    adapted = adapted
      .replace(
        `    <Teleport\n      :to="props.sidebarTarget || 'body'"\n      :disabled="!isChihiroHosted || !props.sidebarTarget"\n    >`,
        '    <div class="native-chat-sidebar-root">',
      )
      .replace('    </main>\n    </Teleport>', '    </main>\n    </div>')
      .replace(
        `    <Teleport\n      :to="props.mainTarget || 'body'"\n      :disabled="!isChihiroHosted || !props.mainTarget"\n    >`,
        '    <div class="native-chat-main-root">',
      )
      .replace('    </Teleport>', '    </div>')
      .replace('    </Teleport>\n    <ProjectDialog', '    </div>\n    <ProjectDialog')
      .replace('  sidebarTarget?: string;\n  mainTarget?: string;\n', '')
      .replace('  sidebarTarget: "",\n  mainTarget: "",\n', '')
      .replace('type UserChatProps = {', 'export type UserChatProps = {')
  }

  return adapted
}

for (const sourceFile of [...visited].sort()) {
  const sourcePath = relative(sourceRoot, sourceFile)
  const destination = join(sourceOutputRoot, sourcePath)
  mkdirSync(dirname(destination), { recursive: true })

  if (['.ts', '.js', '.mjs', '.vue'].includes(extname(sourceFile))) {
    const source = readFileSync(sourceFile, 'utf8')
    writeFileSync(destination, adaptSource(sourcePath, source))
  } else {
    cpSync(sourceFile, destination)
  }
}

const manifest = {
  upstream: 'https://github.com/AstrBotDevs/AstrBot',
  revision: '8b958b08e7fef3948d750d2891aabd80c0828f76',
  entry: 'components/user/UserChat.vue',
  files: [...visited].map((file) => relative(sourceRoot, file)).sort(),
  packages: [...dependencies].sort(),
}

writeFileSync(join(moduleRoot, 'source-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
cpSync(join(sourceRoot, '../../LICENSE'), join(moduleRoot, 'LICENSE'))
console.log(`Extracted ${visited.size} files from ${entry}`)
