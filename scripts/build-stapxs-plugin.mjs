import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'vendor/stapxs')
const build = path.join(root, '.cache/stapxs-build')
const localCfgPath = path.join(root, 'config/chihiro.local.json')
const defaults = JSON.parse(fs.readFileSync(path.join(root, 'config/chihiro.default.json'), 'utf8'))
let local = {}
if (fs.existsSync(localCfgPath)) local = JSON.parse(fs.readFileSync(localCfgPath, 'utf8'))

const address = process.env.VITE_CHIHIRO_DEFAULT_ADDRESS
  || defaults.stapxs?.connect?.address
  || '127.0.0.1:5801'
const token = process.env.VITE_CHIHIRO_DEFAULT_TOKEN
  || local.napcat?.onebotWsToken
  || process.env.CHIHIRO_ONEBOT_WS_TOKEN
  || ''

function run(cmd, args, opts = {}) {
  console.log('>', cmd, args.join(' '))
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

function rimraf(p) {
  fs.rmSync(p, { recursive: true, force: true })
}

if (!fs.existsSync(src)) {
  console.error('missing vendor/stapxs — Chihiro IM source should live in this tree, not as a submodule')
  process.exit(1)
}

const nestedAssets = [
  path.join(src, 'src/renderer/public/bcui'),
  path.join(src, 'src/renderer/src/assets/img/qq-face'),
]
const nestedReady = nestedAssets.every((p) => fs.existsSync(p) && fs.readdirSync(p).length > 0)
if (!nestedReady) {
  console.error('missing qq-face or bcui assets under vendor/stapxs')
  process.exit(1)
}

console.log('syncing vendor/stapxs -> .cache/stapxs-build')
fs.mkdirSync(path.dirname(build), { recursive: true })
// Keep cache node_modules for faster rebuilds. IM source is already Chihiro-adapted.
run('rsync', [
  '-a',
  '--delete',
  '--exclude', 'node_modules',
  '--exclude', '.git',
  '--exclude', '**/node_modules',
  `${src}/`,
  `${build}/`
])

const env = {
  ...process.env,
  VITE_NAPCAT: '1',
  VITE_CHIHIRO: '1',
  VITE_CHIHIRO_DEFAULT_ADDRESS: address,
  VITE_CHIHIRO_DEFAULT_TOKEN: token,
  VITE_CHIHIRO_AUTO_CONNECT: 'true',
  VITE_CHIHIRO_APP_TITLE: '千寻'
}
console.log('build env defaults:', { address, token: token ? '(set)' : '(empty)' })

// dependencies
if (!fs.existsSync(path.join(build, 'node_modules'))) {
  // prefer yarn classic/berry via corepack
  run('corepack', ['enable'], { cwd: build, env })
  run('yarn', ['install'], { cwd: build, env })
}

run('yarn', ['build:napcat'], { cwd: build, env })

// napcat-postbuild may fail zip if plugin deps missing; ensure plugin package built
const pluginDir = path.join(build, 'ssqq.napcat-plugin')
if (!fs.existsSync(path.join(pluginDir, 'node_modules'))) {
  run('npm', ['install'], { cwd: pluginDir, env })
}
if (!fs.existsSync(path.join(pluginDir, 'dist/index.mjs'))) {
  run('npm', ['run', 'build'], { cwd: pluginDir, env })
}
if (!fs.existsSync(path.join(pluginDir, 'napcat-plugin-ssqq.zip'))) {
  run('npm', ['run', 'build:zip'], { cwd: pluginDir, env })
}
const entry = path.join(pluginDir, 'dist/index.mjs')
if (fs.existsSync(entry)) {
  fs.copyFileSync(entry, path.join(pluginDir, 'index.mjs'))
}


const zip = path.join(build, 'ssqq.napcat-plugin/napcat-plugin-ssqq.zip')
const distPlugin = path.join(build, 'ssqq.napcat-plugin')
const outDir = path.join(root, 'dist/plugins')
fs.mkdirSync(outDir, { recursive: true })
if (fs.existsSync(zip)) {
  fs.copyFileSync(zip, path.join(outDir, 'napcat-plugin-ssqq.zip'))
  console.log('copied zip ->', path.join(outDir, 'napcat-plugin-ssqq.zip'))
}
// also copy unpacked plugin folder for direct install
const unpackedOut = path.join(outDir, 'napcat-plugin-ssqq')
rimraf(unpackedOut)
run('rsync', ['-a', '--delete', '--exclude', 'node_modules', `${distPlugin}/`, `${unpackedOut}/`])
console.log('unpacked plugin ->', unpackedOut)
