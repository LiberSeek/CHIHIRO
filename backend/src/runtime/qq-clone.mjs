import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const QQ_APP = '/Applications/QQ.app'
const BUNDLE_ID = 'ai.chihiro.qq'
const CLONE_FIX = 'loader-cjs-v3'

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function officialVersion() {
  const pkg = readJson(path.join(QQ_APP, 'Contents/Resources/app/package.json'))
  return pkg?.version || pkg?.buildVersion || 'unknown'
}

export function clonePaths(root) {
  const runtimes = path.join(root, 'data/runtimes')
  const app = path.join(runtimes, 'QQ.app')
  return {
    runtimes,
    app,
    bin: path.join(app, 'Contents/MacOS/QQ'),
    marker: path.join(runtimes, 'QQ.clone.json'),
    entitlements: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'qq.entitlements.plist'),
    icon: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'icon.icns')
  }
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts })
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || '').trim() || `${cmd} failed`
    throw new Error(err)
  }
  return r
}

function setPlistString(infoPlist, key, value) {
  run('plutil', ['-replace', key, '-string', value, infoPlist])
}

function rewriteElectronHelperIds(appPath) {
  const mapping = [
    ['Contents/Info.plist', BUNDLE_ID],
    ['Contents/Frameworks/QQ Helper.app/Contents/Info.plist', `${BUNDLE_ID}.helper`],
    ['Contents/Frameworks/QQ Helper (GPU).app/Contents/Info.plist', `${BUNDLE_ID}.helper.GPU`],
    ['Contents/Frameworks/QQ Helper (Plugin).app/Contents/Info.plist', `${BUNDLE_ID}.helper.Plugin`],
    ['Contents/Frameworks/QQ Helper (Renderer).app/Contents/Info.plist', `${BUNDLE_ID}.helper.Renderer`]
  ]
  for (const [rel, id] of mapping) {
    const info = path.join(appPath, rel)
    if (!fs.existsSync(info)) continue
    setPlistString(info, 'CFBundleIdentifier', id)
  }
}

function patchNapcatQuickLogin(napcatMjs) {
  if (!fs.existsSync(napcatMjs)) return false
  let src = fs.readFileSync(napcatMjs, 'utf8')
  const orig = src
  src = src.replace(
    `e.logError("快速登录错误：", u), ve.setQQLoginError(u);
          const { success: l, attempted: d } = await s(r);
          !l && !d && !t.isLogined && n.getQRCodePicture();`,
    `e.logError("快速登录错误：", u), ve.setQQLoginError(u);
          if (/手Q验证/.test(String(u))) { e.log("等待手机 QQ 确认登录"); return; }
          const { success: l, attempted: d } = await s(r);
          !l && !d && !t.isLogined && n.getQRCodePicture();`
  )
  src = src.replace(
    `const d = u.loginErrorInfo?.errMsg || \`快速登录失败，错误码: \${u.result}\`;
        ve.setQQLoginError(d), n.getQRCodePicture(), c({ result: !1, message: d });`,
    `const d = u.loginErrorInfo?.errMsg || \`快速登录失败，错误码: \${u.result}\`;
        ve.setQQLoginError(d), /手Q验证/.test(String(d)) || n.getQRCodePicture(), c({ result: !1, message: d });`
  )
  if (src === orig) return src.includes('等待手机 QQ 确认登录')
  fs.writeFileSync(napcatMjs, src)
  return true
}

function embedNapcat(appPath) {
  const src = path.join(
    os.homedir(),
    'Library/Containers/com.tencent.qq/Data/Documents/napcat'
  )
  if (!fs.existsSync(path.join(src, 'napcat.mjs'))) {
    throw new Error('未找到本机 NapCat（Documents/napcat/napcat.mjs）')
  }
  const dest = path.join(appPath, 'Contents/Resources/app/chihiro-napcat')
  fs.mkdirSync(dest, { recursive: true })
  run('rsync', ['-a', '--delete', `${src}/`, `${dest}/`])
  patchNapcatQuickLogin(path.join(dest, 'napcat.mjs'))
  const loaderPath = path.join(appPath, 'Contents/Resources/app/loadNapCat.cjs')
  fs.writeFileSync(loaderPath, `const path = require('path')
const loadNapcat = process.argv.includes('--no-sandbox')
const appDir = __dirname
const pkg = require(path.join(appDir, 'package.json'))
if (loadNapcat) {
    (async () => {
        await import('file://' + path.join(appDir, 'chihiro-napcat/napcat.mjs'))
    })()
} else {
    require(path.join(appDir, 'app_launcher/index.js'))
    setImmediate(() => {
        if (global.launcher && global.launcher.installPathPkgJson) {
            global.launcher.installPathPkgJson.main = ((version) => {
                if (version >= 29271) return './application.asar/app_launcher/index.js'
                if (version >= 28060) return './application/app_launcher/index.js'
                return './app_launcher/index.js'
            })(pkg.buildVersion)
        }
    })
}
`)
  const pkgPath = path.join(appPath, 'Contents/Resources/app/package.json')
  const pkg = readJson(pkgPath)
  if (!pkg) throw new Error('clone package.json missing')
  pkg.main = './loadNapCat.cjs'
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

function signClone(appPath, entitlements) {
  const helpers = [
    'Contents/Frameworks/QQ Helper.app',
    'Contents/Frameworks/QQ Helper (GPU).app',
    'Contents/Frameworks/QQ Helper (Plugin).app',
    'Contents/Frameworks/QQ Helper (Renderer).app'
  ]
  const sign = (target) => {
    run('codesign', [
      '--force',
      '--sign', '-',
      '--options', 'runtime',
      '--entitlements', entitlements,
      '--timestamp=none',
      target
    ], { timeout: 120000 })
  }
  for (const rel of helpers) {
    const p = path.join(appPath, rel)
    if (fs.existsSync(p)) sign(p)
  }
  const nt = path.join(appPath, 'Contents/Frameworks/QQNT.framework')
  if (fs.existsSync(nt)) sign(nt)
  sign(appPath)
}

export function ensureQqClone(root) {
  if (process.platform !== 'darwin') {
    throw new Error('独立 QQ 多开目前只在 macOS 上实现')
  }
  if (!fs.existsSync(QQ_APP)) {
    throw new Error('未找到 /Applications/QQ.app')
  }
  const paths = clonePaths(root)
  const version = officialVersion()
  const marker = readJson(paths.marker)
  if (
    fs.existsSync(paths.bin) &&
    marker?.version === version &&
    marker?.bundleId === BUNDLE_ID &&
    marker?.fix === CLONE_FIX
  ) {
    patchNapcatQuickLogin(path.join(paths.app, 'Contents/Resources/app/chihiro-napcat/napcat.mjs'))
    return paths
  }

  fs.mkdirSync(paths.runtimes, { recursive: true })
  if (fs.existsSync(paths.app)) {
    fs.rmSync(paths.app, { recursive: true, force: true })
  }

  const copied = spawnSync('cp', ['-cR', QQ_APP, paths.app], { encoding: 'utf8' })
  if (copied.status !== 0) {
    run('ditto', [QQ_APP, paths.app])
  }

  rewriteElectronHelperIds(paths.app)
  embedNapcat(paths.app)
  if (fs.existsSync(paths.icon)) {
    fs.copyFileSync(paths.icon, path.join(paths.app, 'Contents/Resources/icon.icns'))
  }
  spawnSync('xattr', ['-cr', paths.app])
  signClone(paths.app, paths.entitlements)

  fs.writeFileSync(paths.marker, JSON.stringify({
    version,
    bundleId: BUNDLE_ID,
    fix: CLONE_FIX,
    createdAt: new Date().toISOString()
  }, null, 2) + '\n')
  return paths
}
