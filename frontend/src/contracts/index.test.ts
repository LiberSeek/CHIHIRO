import { describe, expect, it } from 'vitest'

import { accountId, conversationId } from './index'

describe('contracts', () => {
  it('creates stable branded identifiers without changing wire values', () => {
    expect(accountId('qq-1')).toBe('qq-1')
    expect(conversationId('group-42')).toBe('group-42')
  })
})
