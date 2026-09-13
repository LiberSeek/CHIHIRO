import fs from 'node:fs'
import path from 'node:path'

const appRoot = process.env.CHIHIRO_APP_ROOT || '/app'
const dataDir = path.join(appRoot, 'data')
const statePath = path.join(dataDir, 'chihiro.local.json')
const configPath = path.join(appRoot, 'config/chihiro.local.json')
const templatePath = path.join(appRoot, 'deploy/chihiro.local.json.template')

fs.mkdirSync(dataDir, { recursive: true })

const template = fs.readFileSync(templatePath, 'utf8')
const rendered = template.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => {
  const value = process.env[name]
  if (value == null) throw new Error(`missing deployment environment variable: ${name}`)
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
})

function merge(current, desired) {
  if (
    !current ||
    typeof current !== 'object' ||
    Array.isArray(current) ||
    !desired ||
    typeof desired !== 'object' ||
    Array.isArray(desired)
  ) {
    return desired
  }
  const out = { ...current }
  for (const [key, value] of Object.entries(desired)) {
    out[key] = key in out ? merge(out[key], value) : value
  }
  return out
}

const desired = JSON.parse(rendered)
let current = {}
if (fs.existsSync(statePath)) current = JSON.parse(fs.readFileSync(statePath, 'utf8'))
const config = merge(current, desired)
fs.writeFileSync(statePath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
fs.chmodSync(statePath, 0o600)

fs.rmSync(configPath, { force: true })
fs.symlinkSync(statePath, configPath)
