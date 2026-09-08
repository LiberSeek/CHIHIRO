import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const targetRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, '.cache/stapxs-build')
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'overlays/stapxs/manifest.json'), 'utf8')
)

function mustRead(file) {
  const p = path.join(targetRoot, file)
  if (!fs.existsSync(p)) throw new Error(`missing file: ${file}`)
  return { p, text: fs.readFileSync(p, 'utf8') }
}

let changed = 0
for (const item of manifest.replacements || []) {
  const { p, text } = mustRead(item.file)
  if (!text.includes(item.from)) {
    if (text.includes(item.to)) {
      console.log(`skip (already applied): ${item.file}`)
      continue
    }
    throw new Error(`pattern not found in ${item.file}`)
  }
  fs.writeFileSync(p, text.replace(item.from, item.to))
  changed++
  console.log(`patched: ${item.file}`)
}

for (const item of manifest.snippetPatches || []) {
  const { p, text } = mustRead(item.file)
  if (!text.includes(item.anchor)) {
    if (item.replaceAnchorWith && text.includes('Chihiro fallback')) {
      console.log(`skip (already applied): ${item.file} snippet`)
      continue
    }
    throw new Error(`anchor not found in ${item.file}: ${item.anchor}`)
  }
  fs.writeFileSync(p, text.replace(item.anchor, item.replaceAnchorWith))
  changed++
  console.log(`snippet: ${item.file}`)
}

console.log(`overlay applied (${changed} changes) -> ${targetRoot}`)
