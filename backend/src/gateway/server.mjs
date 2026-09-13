/*
 * Product backend entrypoint.
 *
 * The Gateway implementation is still being extracted from apps/. Keeping
 * this adapter as the only backend start command lets Docker and local
 * development switch to the new product boundary without creating a second
 * HTTP server or changing the browser contract during migration.
 */
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const productRoot = path.resolve(backendRoot, '..')
const legacyGateway = path.join(productRoot, 'apps/gateway/src/server.js')

// The legacy Gateway derives paths from its own source location, so importing
// it preserves the existing config, data, vendor, proxy and shutdown behavior.
await import(pathToFileURL(legacyGateway).href)
