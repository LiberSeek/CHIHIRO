import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const RECENT_CONTACT_UNREAD_MARK = 'chihiro-recent-contact-unread'

const WRAP_SOURCE = fs.readFileSync(
  fileURLToPath(new URL('./chihiro-napcat-unread-plugin.mjs', import.meta.url)),
  'utf8',
)

export function injectRecentContactUnread(pluginDir) {
  if (!pluginDir || !fs.existsSync(pluginDir)) return false
  const indexPath = path.join(pluginDir, 'index.mjs')
  const originalPath = path.join(pluginDir, 'index.ssqq.mjs')
  if (!fs.existsSync(indexPath)) return false

  const current = fs.readFileSync(indexPath, 'utf8')
  const alreadyWrapped = current.includes(RECENT_CONTACT_UNREAD_MARK)
  if (!alreadyWrapped) {
    fs.copyFileSync(indexPath, originalPath)
  } else if (!fs.existsSync(originalPath)) {
    return false
  }

  if (current !== WRAP_SOURCE) fs.writeFileSync(indexPath, WRAP_SOURCE)
  return true
}
