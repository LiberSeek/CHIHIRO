import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function short(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

const stapxsUpstream = readUpstream(path.join(root, 'vendor/stapxs/UPSTREAM'))
console.log('stapxs     in-tree IM  (edit vendor/stapxs directly)')
console.log(`           pinned ${stapxsUpstream.commit || '?'}  from ${stapxsUpstream.repo || 'Stapxs-QQ-Lite-2.0'} ${stapxsUpstream.branch || 'next'}`)

const remotes = [
  { name: 'napcat', dir: 'vendor/napcat', url: 'https://github.com/NapNeko/NapCatQQ.git', note: '协议参考；Mac 日用跑本机 Shell' },
  { name: 'astrbot', dir: 'vendor/astrbot', url: 'https://github.com/AstrBotDevs/AstrBot.git', note: '自动化对照 / 按需 Bot' }
]

for (const r of remotes) {
  const abs = path.join(root, r.dir)
  if (!fs.existsSync(abs)) {
    console.log(`${r.name.padEnd(10)} MISSING  ${r.url}`)
    continue
  }
  const head = short('git rev-parse --short HEAD', abs)
  const branch = short('git rev-parse --abbrev-ref HEAD', abs)
  const desc = short('git describe --tags --always', abs)
  console.log(`${r.name.padEnd(10)} ${desc || head || '?'}  (${branch || '?'})`)
  console.log(`           ${r.note}`)
}

function readUpstream(file) {
  const out = {}
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const i = line.indexOf('=')
      if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
    }
  } catch {}
  return out
}
