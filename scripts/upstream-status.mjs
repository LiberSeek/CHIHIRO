import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const remotes = [
  { name: 'stapxs', dir: 'vendor/stapxs', url: 'https://github.com/Stapxs/Stapxs-QQ-Lite-2.0.git', note: 'IM UI（主修改面）' },
  { name: 'astrbot', dir: 'vendor/astrbot', url: 'https://github.com/AstrBotDevs/AstrBot.git', note: '自动化' },
  { name: 'napcat', dir: 'vendor/napcat', url: 'https://github.com/NapNeko/NapCatQQ.git', note: '协议参考；Mac 日用跑本机 Shell' },
  { name: 'pake', dir: '../XRefs/Pake', url: 'https://github.com/tw93/Pake.git', note: '桌面壳打包' }
]

function short(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

for (const r of remotes) {
  const abs = path.join(root, r.dir)
  if (!fs.existsSync(abs)) {
    console.log(`${r.name.padEnd(10)} MISSING  ${r.url}`)
    console.log(`           hint: git submodule add ${r.url} ${r.dir}`)
    console.log(`           ${r.note}`)
    continue
  }
  const head = short('git rev-parse --short HEAD', abs)
  const branch = short('git rev-parse --abbrev-ref HEAD', abs)
  const desc = short('git describe --tags --always', abs)
  console.log(`${r.name.padEnd(10)} ${desc || head || '?'}  (${branch || '?'})`)
  console.log(`           ${r.note}`)
}

console.log('\nXRefs (local reference clones, not necessarily submodules):')
for (const name of ['NapCatQQ', 'AstrBot', 'linuxdo-wecom-ui']) {
  const p = path.join(root, 'XRefs', name)
  const real = fs.existsSync(p) ? fs.realpathSync(p) : null
  console.log(`  ${name}: ${real || 'missing'}`)
}
