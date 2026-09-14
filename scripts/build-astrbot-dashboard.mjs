import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vendor = path.join(root, 'vendor/astrbot')
const dashboard = path.join(vendor, 'dashboard')
const distSrc = path.join(dashboard, 'dist')
const distBundled = path.join(vendor, 'astrbot/dashboard/dist')
const dataDist = path.join(root, 'data/astrbot/data/dist')

function run(cmd, args, opts = {}) {
  console.log('>', cmd, args.join(' '))
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

function copyDist(from, to) {
  fs.rmSync(to, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.cpSync(from, to, { recursive: true })
}

function astrbotVersion() {
  const init = fs.readFileSync(path.join(vendor, 'astrbot/__init__.py'), 'utf8')
  const m = init.match(/__version__\s*=\s*"([^"]+)"/)
  return m ? m[1] : '0.0.0'
}

if (!fs.existsSync(dashboard)) {
  console.error('missing vendor/astrbot/dashboard')
  process.exit(1)
}

if (!fs.existsSync(path.join(dashboard, 'node_modules'))) {
  run('npm', ['install'], { cwd: dashboard })
}

run('npm', ['run', 'build', '--', '--base=/astrbot/'], { cwd: dashboard })
run('npm', ['run', 'build:chihiro'], { cwd: dashboard })

const dashboardIndex = path.join(distSrc, 'index.html')
if (!fs.existsSync(dashboardIndex)) {
  console.error('dashboard build did not produce dist/index.html')
  process.exit(1)
}

const dashboardHtml = fs.readFileSync(dashboardIndex, 'utf8')
if (!dashboardHtml.includes('/astrbot/assets/') || /["'(]\/assets\//.test(dashboardHtml)) {
  console.error('dashboard build contains assets outside the /astrbot/ gateway prefix')
  process.exit(1)
}

const versionDir = path.join(distSrc, 'assets')
fs.mkdirSync(versionDir, { recursive: true })
fs.writeFileSync(path.join(versionDir, 'version'), astrbotVersion() + '\n')

copyDist(distSrc, distBundled)
console.log('copied dashboard dist -> vendor/astrbot/astrbot/dashboard/dist')

if (fs.existsSync(path.join(root, 'data/astrbot'))) {
  copyDist(distSrc, dataDist)
  console.log('copied dashboard dist -> data/astrbot/data/dist')
}

console.log('rebuild:astrbot-ui done')
