import { describe, expect, it } from 'vitest'
import { forwardContactKey, hasOutgoingContent, prioritizeForwardContacts } from './chat-interaction'

describe('native IM chat interactions', () => {
  it('does not send an empty composer', () => {
    expect(hasOutgoingContent({ text: '', attachmentCount: 0, hasInlineFaces: false, hasInlineAts: false })).toBe(false)
    expect(hasOutgoingContent({ text: '', attachmentCount: 0, hasInlineFaces: true, hasInlineAts: false })).toBe(true)
    expect(hasOutgoingContent({ text: '', attachmentCount: 1, hasInlineFaces: false, hasInlineAts: false })).toBe(true)
  })

  it('prioritizes recent forward targets without mutating contact order', () => {
    const contacts = [{ user_id: 1 }, { group_id: 2 }, { user_id: 3 }]
    const ordered = prioritizeForwardContacts(contacts, [{ user_id: 3 }, { group_id: 2 }, { user_id: 9 }])
    expect(ordered.map(forwardContactKey)).toEqual(['user-3', 'group-2', 'user-1'])
    expect(contacts.map(forwardContactKey)).toEqual(['user-1', 'group-2', 'user-3'])
  })
})
