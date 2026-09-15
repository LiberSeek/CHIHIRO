import { describe, expect, it, vi } from 'vitest'

vi.mock('./host', () => ({ default: {}, i18n: {} }))
vi.mock('./src/function/option', () => ({ default: {} }))
vi.mock('./src/function/base', () => ({
  Logger: class { error = vi.fn() }, PopInfo: class {}, PopType: {},
}))
vi.mock('./src/function/connect', () => ({ Connector: {} }))
vi.mock('./src/function/utils/appUtil', () => ({ sendStatEvent: vi.fn() }))
vi.mock('./src/runtime/backend', () => ({ backend: {} }))
vi.mock('./src/state/auth', () => ({ useAuthStore: () => ({ loginInfo: { uin: '10001' } }) }))
vi.mock('./src/state/settings', () => ({ useSettingsStore: vi.fn() }))
vi.mock('./src/state/contact', () => ({ useContactStore: vi.fn() }))
vi.mock('./src/state/ui', () => ({ useUIStore: vi.fn() }))
vi.mock('./src/state/chat', () => ({ useChatStore: vi.fn() }))

import { getMsgData } from './src/function/utils/msgUtil'

describe('native IM JSONPath message mapping', () => {
  it('maps recent contacts from a provider response', () => {
    const response = { data: [{ peerUin: '20001', chatType: 1, unread: 5 }, { peerUin: '30001', chatType: 2 }] }
    expect(getMsgData('recent_contact', response, {
      source: '$.data[*]', list: { user_id: '/peerUin', chat_type: '/chatType', unread: '/unread' },
    })).toEqual([
      { user_id: '20001', chat_type: 1, unread: 5 },
      { user_id: '30001', chat_type: 2, unread: undefined },
    ])
  })

  it('returns an empty result when no file response matches', () => {
    expect(getMsgData('file_download', {}, '$.data.files[*]')).toEqual([])
  })

  it('leaves an invalid mapping unresolved instead of inventing data', () => {
    expect(getMsgData('file_download', {}, '$[')).toBeUndefined()
  })

  it('resolves the active account placeholder and object field maps', () => {
    expect(getMsgData('account', { accounts: { '10001': { name: 'Active' } } },
      { nickname: '$.accounts["<uin>"].name', _comment: 'metadata' },
    )).toEqual([{ nickname: 'Active' }])
  })
})
