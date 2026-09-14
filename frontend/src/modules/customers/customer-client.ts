import { z } from 'zod'

const sourceSchema = z.object({
  id: z.string().optional(),
  conversationId: z.string(),
  messageId: z.string(),
  messageAt: z.number().optional(),
  observedAt: z.number().optional(),
  text: z.string().optional(),
})

const factSchema = z.object({
  id: z.string(),
  kind: z.string(),
  value: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  updatedAt: z.number().optional(),
  sources: z.array(sourceSchema).default([]),
})

const intentSchema = z.object({
  id: z.string(),
  kind: z.string(),
  label: z.string(),
  status: z.string().optional(),
  score: z.number().min(0).max(1).optional(),
  updatedAt: z.number().optional(),
  sources: z.array(sourceSchema).default([]),
})

const customerSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  channel: z.string(),
  peerId: z.string(),
  peerType: z.string().optional(),
  displayName: z.string(),
  tags: z.array(z.string()),
  notes: z.string(),
  factCount: z.number().int().nonnegative(),
  intentCount: z.number().int().nonnegative(),
  openIntentCount: z.number().int().nonnegative(),
  topIntent: intentSchema.nullable().optional(),
  lastEvidenceAt: z.number().optional(),
  updatedAt: z.number().optional(),
})

const detailSchema = customerSchema.extend({
  facts: z.array(factSchema).default([]),
  intents: z.array(intentSchema).default([]),
  evidence: z.array(sourceSchema).default([]),
})

const listSchema = z.object({
  customers: z.array(customerSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
})

export type CustomerSummary = z.infer<typeof customerSchema>
export type CustomerDetail = z.infer<typeof detailSchema>
export type CustomerFact = z.infer<typeof factSchema>
export type CustomerIntent = z.infer<typeof intentSchema>
export type CustomerEvidence = z.infer<typeof sourceSchema>
export interface CustomerPatch { displayName: string; tags: string[]; notes: string }

async function api<T>(path: string, accountId: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')
  headers.set('X-Chihiro-Account', accountId)
  if (init?.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(path, { ...init, cache: 'no-store', headers })
  const body: unknown = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
      ? body.message
      : body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `客户 API ${response.status}`
    throw new Error(message)
  }
  try { return schema.parse(body) }
  catch { throw new Error('客户资料响应格式无效') }
}

export function createCustomerClient(base = '/api/runtime/customers') {
  return {
    list(accountId: string, query: string, signal?: AbortSignal) {
      const params = new URLSearchParams({ limit: '100' })
      if (query.trim()) params.set('q', query.trim())
      return api(`${base}?${params}`, accountId, listSchema, { signal })
    },
    get(accountId: string, id: string, signal?: AbortSignal) {
      return api(`${base}/${encodeURIComponent(id)}`, accountId, detailSchema, { signal })
    },
    update(accountId: string, id: string, patch: CustomerPatch, signal?: AbortSignal) {
      return api(`${base}/${encodeURIComponent(id)}`, accountId, detailSchema, {
        method: 'PATCH', signal, body: JSON.stringify(patch),
      })
    },
  }
}
