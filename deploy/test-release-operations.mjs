import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = path.resolve(import.meta.dirname, '..')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'chihiro-release-operations-'))
const bin = path.join(temporary, 'bin')
const state = path.join(temporary, 'state')
fs.mkdirSync(bin)
fs.mkdirSync(state)

fs.writeFileSync(path.join(bin, 'docker'), `#!/bin/sh
set -eu
state=${shellQuote(state)}
command=$1
shift
case "$command" in
  volume)
    sub=$1; shift
    case "$sub" in
      inspect) [ -d "$state/$1" ] ;;
      create) mkdir -p "$state/$1"; echo "$1" ;;
    esac
    ;;
  run)
    [ "$1" = "--rm" ] && shift
    source=""; target=""; backup=""
    while [ "$#" -gt 0 ]; do
      case "$1" in
        -v)
          mapping=$2; shift 2
          host=$(printf '%s' "$mapping" | cut -d: -f1)
          guest=$(printf '%s' "$mapping" | cut -d: -f2)
          [ "$guest" = "/source" ] && source="$state/$host"
          [ "$guest" = "/target" ] && target="$state/$host"
          [ "$guest" = "/backup" ] && backup="$host"
          ;;
        alpine:3.23) shift ;;
        *) break ;;
      esac
    done
    if [ "$1" = "tar" ]; then
      if [ "$4" = "-czf" ]; then tar -C "$source" -czf "$backup/$(basename "$5")" .; else tar -C "$target" -xzf "$backup/$(basename "$5")"; fi
    else
      find "$target" -mindepth 1 -depth -delete
    fi
    ;;
esac
`)
fs.chmodSync(path.join(bin, 'docker'), 0o755)

for (const name of ['chihiro_chihiro-data', 'chihiro_astrbot-data']) {
  fs.mkdirSync(path.join(state, name), { recursive: true })
  fs.writeFileSync(path.join(state, name, 'payload.txt'), `data from ${name}`)
}

const environment = { ...process.env, PATH: `${bin}:${process.env.PATH}` }
const archive = path.join(temporary, 'backup.tar.gz')
run('deploy/scripts/backup.sh', [archive], environment)
for (const name of ['chihiro_chihiro-data', 'chihiro_astrbot-data']) fs.writeFileSync(path.join(state, name, 'payload.txt'), 'changed')
run('deploy/scripts/restore.sh', [archive], { ...environment, CHIHIRO_RESTORE_CONFIRM: 'restore' })
assert.equal(fs.readFileSync(path.join(state, 'chihiro_chihiro-data', 'payload.txt'), 'utf8'), 'data from chihiro_chihiro-data')
assert.equal(fs.readFileSync(path.join(state, 'chihiro_astrbot-data', 'payload.txt'), 'utf8'), 'data from chihiro_astrbot-data')
const denied = spawnSync(path.join(root, 'deploy/scripts/restore.sh'), [archive], { cwd: root, env: environment, encoding: 'utf8' })
assert.equal(denied.status, 65)
console.log('release backup and restore round trip passed')

fs.rmSync(temporary, { recursive: true, force: true })

function run(command, args, env) {
  const result = spawnSync(path.join(root, command), args, { cwd: root, env, encoding: 'utf8' })
  assert.equal(result.status, 0, `${command}: ${result.stderr || result.stdout}`)
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`
}
