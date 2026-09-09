#!/usr/bin/env node
/**
 * Wrap Chihiro IM entry with Pake (https://github.com/tw93/Pake).
 *
 * Prerequisite:
 *   npm i -g pake-cli
 *   or: npx pake-cli ...
 *
 * NapCat Shell + OneBot must already be running on the host.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config/chihiro.default.json'), 'utf8'))
let local = {}
const localPath = path.join(root, 'config/chihiro.local.json')
if (fs.existsSync(localPath)) local = JSON.parse(fs.readFileSync(localPath, 'utf8'))

const webuiToken = process.env.CHIHIRO_WEBUI_TOKEN || local.napcat?.webuiToken
const url = webuiToken
  ? `${cfg.napcat.webui}${cfg.stapxs.pluginPage}?webui_token=${encodeURIComponent(webuiToken)}`
  : (cfg.pake.url || `http://127.0.0.1:${cfg.gateway.port}/im/`)

const name = cfg.pake.name || '千寻'
const width = cfg.pake.width || 1200
const height = cfg.pake.height || 800
const outDir = path.join(root, 'apps/desktop/dist')
fs.mkdirSync(outDir, { recursive: true })

const icon = path.join(root, 'branding/chihiro.icns')
const args = [
  'pake-cli',
  url,
  '--name', name,
  '--width', String(width),
  '--height', String(height),
  '--hide-title-bar',
  '--multi-arch'
]
if (fs.existsSync(icon)) args.push('--icon', icon)

console.log('Pake target URL:', url)
console.log('Running: npx', args.join(' '))
console.log('Note: first build may take a while; keep NapCat Shell logged in.')

const r = spawnSync('npx', ['--yes', ...args], {
  cwd: outDir,
  stdio: 'inherit',
  shell: process.platform === 'win32'
})
process.exit(r.status ?? 1)
