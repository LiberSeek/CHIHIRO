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
const submodules = [
  ['vendor/stapxs', 'https://github.com/Stapxs/Stapxs-QQ-Lite-2.0.git'],
  ['vendor/napcat', 'https://github.com/NapNeko/NapCatQQ.git'],
  ['vendor/astrbot', 'https://github.com/AstrBotDevs/AstrBot.git']
]

for (const [dir, url] of submodules) {
  if (!gitmodules.includes(`path = ${dir}`)) fail(`.gitmodules 缺少 ${dir}`)
  if (!gitmodules.includes(`url = ${url}`)) fail(`${dir} 的上游 URL 不匹配`)
  if (!exists(dir)) fail(`缺少 submodule 目录 ${dir}`)
  if (!exists(`${dir}/.git`)) fail(`${dir} 不是已初始化的 submodule`)
}

const manifestPath = 'overlays/stapxs/manifest.json'
let manifest = null
try {
  manifest = JSON.parse(read(manifestPath) || '')
} catch (error) {
  fail(`${manifestPath} 不是有效 JSON: ${error.message}`)
}

for (const item of [...(manifest?.replacements || []), ...(manifest?.snippetPatches || [])]) {
  if (!item.file) {
    fail('overlay 项缺少 file')
    continue
  }
  const source = read(`vendor/stapxs/${item.file}`)
  if (source === null) {
    fail(`overlay 目标文件不存在: vendor/stapxs/${item.file}`)
    continue
  }
  const anchor = item.from || item.anchor
  if (anchor && !source.includes(anchor)) {
    fail(`overlay 锚点已漂移: vendor/stapxs/${item.file}`)
  }
}

for (const rel of [
  'apps/gateway/src/server.js',
  'apps/runtime/src/api.mjs',
  'apps/web/index.html',
  'scripts/apply-stapxs-overlay.mjs',
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
console.log(`- submodules: ${submodules.length}`)
console.log(`- overlay entries: ${(manifest.replacements || []).length + (manifest.snippetPatches || []).length}`)
console.log('- product entrypoints: gateway, runtime, web, overlay build')
