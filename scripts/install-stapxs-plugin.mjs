import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'dist/plugins/napcat-plugin-ssqq')
const dest = path.join(
  process.env.HOME,
  'Library/Containers/com.tencent.qq/Data/Library/Application Support/QQ/NapCat/plugins/napcat-plugin-ssqq'
)

if (!fs.existsSync(src)) {
  console.error('missing dist/plugins/napcat-plugin-ssqq — run npm run build:stapxs first')
  process.exit(1)
}

fs.mkdirSync(path.dirname(dest), { recursive: true })
console.log('installing plugin:')
console.log('  from', src)
console.log('  to  ', dest)
const r = spawnSync('rsync', ['-a', '--delete', `${src}/`, `${dest}/`], { stdio: 'inherit' })
if (r.status !== 0) process.exit(r.status ?? 1)
console.log('installed. Enable/reload plugin in NapCat WebUI if needed, then open IM.')
