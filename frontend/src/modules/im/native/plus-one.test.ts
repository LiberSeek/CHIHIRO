import { describe, expect, it } from 'vitest'
import { plusOneContentKey, plusOneSendSegments, shouldShowPlusOne } from './plus-one'

const text = (id: string, value: string, extra: Record<string, unknown> = {}) => ({
  message_id: id,
  post_type: 'message',
  message: [{ type: 'text', text: value }],
  ...extra,
})

describe('plus-one', () => {
  it('fingerprints sendable text and skips images', () => {
    expect(plusOneContentKey(text('a', '321'))).toBe('321')
    expect(plusOneContentKey(text('b', '  321  '))).toBe('321')
    expect(plusOneContentKey({
      message: [{ type: 'image', url: 'x' }],
    })).toBeNull()
    expect(plusOneContentKey({ message: [] })).toBeNull()
  })

  it('shows +1 only on the latest message, never on historical streaks', () => {
    const list = [
      text('a', '123'),
      text('b', '123'),
      text('c', 'sadasd'),
      text('d', '123'),
      text('e', '123'),
      text('f', '321'),
      text('g', '321'),
    ]
    expect(list.map((_, i) => shouldShowPlusOne(list, i))).toEqual([
      false, false, false, false, false, false, true,
    ])
    const interrupted = [text('a', '123'), text('b', '321'), text('c', '321'), text('d', 'ok')]
    expect(interrupted.map((_, i) => shouldShowPlusOne(interrupted, i))).toEqual([
      false, false, false, false,
    ])
  })

  it('keeps +1 on the last item of a longer identical streak', () => {
    const list = [text('a', '321'), text('b', '321'), text('c', '321')]
    expect(shouldShowPlusOne(list, 0)).toBe(false)
    expect(shouldShowPlusOne(list, 1)).toBe(false)
    expect(shouldShowPlusOne(list, 2)).toBe(true)
  })

  it('does not show +1 when a later chat message sits after the pair', () => {
    const list = [
      text('a', '321'),
      text('b', '321'),
      { message_id: 'img', post_type: 'message', message: [{ type: 'image', url: 'x' }] },
    ]
    expect(shouldShowPlusOne(list, 0)).toBe(false)
    expect(shouldShowPlusOne(list, 1)).toBe(false)
    expect(shouldShowPlusOne(list, 2)).toBe(false)
  })

  it('skips notices, deleted, and in-flight messages when finding neighbors', () => {
    const list = [
      text('a', '321'),
      { post_type: 'notice', message: [] },
      text('b', '321'),
      { ...text('gone', '321'), raw_message: '[已删除]' },
    ]
    expect(shouldShowPlusOne(list, 2)).toBe(true)
    expect(shouldShowPlusOne([
      text('a', '321'),
      text('b', '321'),
      { ...text('c', '321'), fake_msg: true },
    ], 1)).toBe(true)
  })

  it('builds a sendable copy of the last message', () => {
    const msg = {
      message: [
        { type: 'text', text: '321' },
        { type: 'face', id: 1 },
      ],
    }
    expect(plusOneSendSegments(msg)).toEqual([
      { type: 'text', text: '321' },
      { type: 'face', id: 1 },
    ])
    expect(plusOneSendSegments({ message: [{ type: 'image', url: 'x' }] })).toBeNull()
  })
})
