import fs from 'node:fs'
import path from 'node:path'

const file = process.argv[2] || path.resolve('deploy/release-manifest.json')
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
const fail = (message) => { throw new Error(`invalid release manifest: ${message}`) }
if (manifest.schemaVersion !== 1) fail('schemaVersion')
if (manifest.product !== 'chihiro') fail('product')
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version || '')) fail('version')
if (manifest.baselineTag !== '0.0.1') fail('baselineTag')
if (!manifest.images?.chihiro || !manifest.images?.astrbot) fail('images')
if (manifest.support?.linuxNapcat !== 'verified' && manifest.images?.napcat) fail('unverified NapCat image must be null')
console.log(`release manifest ${manifest.version} is valid`)
