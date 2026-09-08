import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config/chihiro.default.json'), 'utf8'))
let local = {}
const localPath = path.join(root, 'config/chihiro.local.json')
if (fs.existsSync(localPath)) local = JSON.parse(fs.readFileSync(localPath, 'utf8'))

const webuiToken = process.env.CHIHIRO_WEBUI_TOKEN || local.napcat?.webuiToken
const target = process.argv[2] || 'im'

const map = {
  home: `http://${cfg.gateway.host}:${cfg.gateway.port}/`,
  im: webuiToken
    ? `${cfg.napcat.webui}${cfg.stapxs.pluginPage}?webui_token=${encodeURIComponent(webuiToken)}`
    : `http://${cfg.gateway.host}:${cfg.gateway.port}/im/`,
  webui: webuiToken
    ? `${cfg.napcat.webui}/webui/?token=${encodeURIComponent(webuiToken)}`
    : `${cfg.napcat.webui}/webui/`,
  astrbot: cfg.astrbot.url,
  status: `http://${cfg.gateway.host}:${cfg.gateway.port}/api/status`
}

const url = map[target]
if (!url) {
  console.error(`Unknown target: ${target}. Use: ${Object.keys(map).join(', ')}`)
  process.exit(1)
}

console.log(url)
spawn('open', [url], { stdio: 'ignore', detached: true }).unref()
