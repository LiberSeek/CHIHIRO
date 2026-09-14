export interface AgentApiBaseOptions {
  hosted?: boolean
  gatewayBase?: string
}

export interface ResolvedAgentApiBase {
  hosted: boolean
  dashboardBase: string
  apiV1Base: string
}

function normalizeBase(base: string) {
  const normalized = base.trim().replace(/\/+$/, '')
  return normalized === '/' ? '' : normalized
}

export function resolveAgentApiBase(options: AgentApiBaseOptions = {}): ResolvedAgentApiBase {
  const hosted = options.hosted ?? false
  const dashboardBase = hosted ? normalizeBase(options.gatewayBase ?? '/astrbot') : ''
  return {
    hosted,
    dashboardBase,
    apiV1Base: `${dashboardBase}/api/v1`,
  }
}
