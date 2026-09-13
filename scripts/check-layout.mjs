import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const errors = []

function exists(rel) {
  return fs.existsSync(path.join(root, rel))
}

function read(rel) {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8')
  } catch {
    return null
  }
}

function fail(message) {
  errors.push(message)
}

const gitmodules = read('.gitmodules') || ''
if (gitmodules.includes('path = vendor/stapxs')) {
  fail('vendor/stapxs must not be a submodule; IM source lives in-tree')
}

const submodules = [
  ['vendor/napcat', 'https://github.com/NapNeko/NapCatQQ.git'],
  ['vendor/astrbot', 'https://github.com/AstrBotDevs/AstrBot.git']
]

for (const [dir, url] of submodules) {
  if (!gitmodules.includes(`path = ${dir}`)) fail(`.gitmodules 缺少 ${dir}`)
  if (!gitmodules.includes(`url = ${url}`)) fail(`${dir} 的上游 URL 不匹配`)
  if (!exists(dir)) fail(`缺少 submodule 目录 ${dir}`)
  if (!exists(`${dir}/.git`)) fail(`${dir} 不是已初始化的 submodule`)
}

if (exists('overlays/stapxs/manifest.json')) {
  fail('overlays/stapxs 已废弃：请直接改 vendor/stapxs，不要恢复 overlay')
}

if (!exists('vendor/stapxs/src/renderer/src/pages/Chat.vue')) {
  fail('缺少 IM 源码 vendor/stapxs')
}
if (!exists('vendor/stapxs/UPSTREAM')) {
  fail('缺少 vendor/stapxs/UPSTREAM（上游钉住信息）')
}
if (!exists('vendor/stapxs/src/renderer/public/bcui')) {
  fail('缺少 vendor/stapxs bcui 资源')
}
if (!exists('vendor/stapxs/src/renderer/src/assets/img/qq-face')) {
  fail('缺少 vendor/stapxs qq-face 资源')
}

for (const rel of [
  'vendor/astrbot/dashboard/src/components/user/UserChat.vue',
  'vendor/astrbot/dashboard/src/layouts/user/UserFullLayout.vue',
  'vendor/astrbot/dashboard/src/layouts/user/UserVerticalHeader.vue',
  'vendor/astrbot/dashboard/src/views/user/UserChatPage.vue',
  'vendor/astrbot/dashboard/src/composables/useChihiroEmbed.ts',
  'scripts/build-astrbot-dashboard.mjs'
]) {
  if (!exists(rel)) fail(`缺少 AstrBot User* / 构建入口 ${rel}`)
}

for (const rel of [
  'AGENTS.md',
  'apps/gateway/src/server.js',
  'apps/runtime/src/api.mjs',
  'apps/web/index.html',
  'scripts/build-stapxs-plugin.mjs'
]) {
  if (!exists(rel)) fail(`缺少产品入口 ${rel}`)
}

if (errors.length) {
  console.error('layout check failed')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('layout check passed')
console.log(`- reference submodules: ${submodules.length} (napcat, astrbot)`)
console.log('- IM source: vendor/stapxs (in-tree, not overlay)')
console.log('- product entrypoints: gateway, runtime, web, stapxs build')
