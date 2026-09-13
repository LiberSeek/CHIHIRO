import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const nativeRoot = dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(await readFile(join(nativeRoot, 'source-manifest.json'), 'utf8'))

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesUnder(path) : [path]
  }))
  return files.flat()
}

const sourceFiles = (await filesUnder(join(nativeRoot, 'src')))
  .map((path) => relative(nativeRoot, path))
  .sort()
const expectedFiles = manifest.files.map((entry) => entry.path).sort()
if (JSON.stringify(sourceFiles) !== JSON.stringify(expectedFiles)) {
  throw new Error('Native IM source file list differs from source-manifest.json')
}

for (const entry of manifest.files) {
  const content = await readFile(join(nativeRoot, entry.path))
  const hash = createHash('sha256').update(content).digest('hex')
  if (hash !== entry.sha256) throw new Error(`Hash mismatch: ${entry.path}`)
  const text = content.toString('utf8')
  if (text.includes('@renderer/main') || /\bcreateApp\s*\(/.test(text)) {
    throw new Error(`Forbidden upstream bootstrap dependency: ${entry.path}`)
  }
}

console.log(`Verified ${manifest.files.length} pinned native IM source files`)
