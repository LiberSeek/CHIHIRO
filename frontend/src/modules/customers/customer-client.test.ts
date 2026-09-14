import { afterEach, describe, expect, it, vi } from 'vitest'

import { createCustomerClient } from './customer-client'

const summary = {
  id: 'cust_1', accountId: 'qq:1', channel: 'qq', peerId: '100', peerType: 'person', displayName: '小千', tags: ['意向'], notes: '',
  factCount: 1, intentCount: 1, openIntentCount: 1, lastEvidenceAt: 1, updatedAt: 1,
}
const detail = {
  ...summary,
  facts: [{ id: 'fact_1', kind: 'need', value: '试用', confidence: 0.8, sources: [] }],
  intents: [{ id: 'intent_1', kind: 'trial', label: '试用', score: 0.9, sources: [] }],
  evidence: [{ id: 'source_1', conversationId: 'private:100', messageId: '42', observedAt: 1, text: '想试用' }],
}
const reply = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => body }) as Response

afterEach(() => vi.unstubAllGlobals())

describe('customer client', () => {
  it('scopes list, detail, and profile updates to the selected account', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(reply({ customers: [summary], total: 1, limit: 100, offset: 0 }))
      .mockResolvedValueOnce(reply(detail))
      .mockResolvedValueOnce(reply(detail))
    vi.stubGlobal('fetch', fetcher)
    const client = createCustomerClient()
    await client.list('qq:1', '小千')
    await client.get('qq:1', 'cust_1')
    await client.update('qq:1', 'cust_1', { displayName: '千寻', tags: ['意向'], notes: '回访' })
    for (const [, init] of fetcher.mock.calls) {
      expect(new Headers(init.headers).get('x-chihiro-account')).toBe('qq:1')
    }
    expect(fetcher.mock.calls[0][0]).toContain('q=%E5%B0%8F%E5%8D%83')
    expect(fetcher.mock.calls[2][1]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ displayName: '千寻', tags: ['意向'], notes: '回访' }) })
  })

  it('rejects malformed runtime responses instead of exposing untrusted fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ customers: [{ id: 'unsafe' }], total: 1, limit: 100, offset: 0 })))
    await expect(createCustomerClient().list('qq:1', '')).rejects.toThrow('格式')
  })
})
