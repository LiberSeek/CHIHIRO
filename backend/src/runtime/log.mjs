function stamp() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '')
}

export function log(scope, ...args) {
  console.log(`[${stamp()}] [${scope}]`, ...args)
}

export function logError(scope, ...args) {
  console.error(`[${stamp()}] [${scope}]`, ...args)
}
