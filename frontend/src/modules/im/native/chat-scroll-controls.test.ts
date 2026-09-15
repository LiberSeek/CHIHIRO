import { describe, expect, it } from 'vitest'
import {
  countIncomingTail,
  firstUnreadMessage,
  isAtChatBottom,
  isElementAboveContainer,
  nextJumpToBottomVisible,
  sessionUnreadCount,
} from './chat-scroll-controls'

describe('chat scroll controls', () => {
  it('treats the viewport as at bottom within slack', () => {
    expect(isAtChatBottom(980, 20, 1000, 16)).toBe(true)
    expect(isAtChatBottom(900, 20, 1000, 16)).toBe(false)
  })

  it('shows jump-to-bottom only while scrolling down away from the bottom', () => {
    expect(nextJumpToBottomVisible({ atBottom: true, delta: 20, visible: true })).toBe(false)
    expect(nextJumpToBottomVisible({ atBottom: false, delta: 12, visible: false })).toBe(true)
    expect(nextJumpToBottomVisible({ atBottom: false, delta: -12, visible: true })).toBe(false)
    expect(nextJumpToBottomVisible({ atBottom: false, delta: 1, visible: true })).toBe(true)
    expect(nextJumpToBottomVisible({ atBottom: false, delta: -1, visible: false })).toBe(false)
    expect(nextJumpToBottomVisible({ atBottom: false, delta: 40, visible: false, settling: true })).toBe(false)
  })

  it('keeps the latest-message pill visible while unread sits below', () => {
    expect(nextJumpToBottomVisible({
      atBottom: false,
      delta: -20,
      visible: false,
      hasLatestBelow: true,
    })).toBe(true)
    expect(nextJumpToBottomVisible({
      atBottom: true,
      delta: 0,
      visible: true,
      hasLatestBelow: true,
    })).toBe(false)
    expect(nextJumpToBottomVisible({
      atBottom: false,
      delta: 12,
      visible: true,
      hasLatestBelow: true,
      settling: true,
    })).toBe(false)
  })

  it('counts incoming tail messages and skips self', () => {
    const list = [
      { message_id: 'a', sender: { user_id: 1 } },
      { message_id: 'b', sender: { user_id: 2 } },
      { message_id: 'me', sender: { user_id: 9 } },
      { message_id: 'c', sender: { user_id: 2 } },
    ]
    expect(countIncomingTail(list, 1, 9)).toBe(2)
    expect(countIncomingTail(list, 4, 9)).toBe(0)
    expect(countIncomingTail(list, 0, 9)).toBe(3)
  })

  it('keeps jump-to-bottom hidden for the whole settle, then stays hidden at bottom', () => {
    let visible = true
    visible = nextJumpToBottomVisible({ atBottom: false, delta: 40, visible, settling: true })
    expect(visible).toBe(false)
    visible = nextJumpToBottomVisible({ atBottom: false, delta: 80, visible, settling: true })
    expect(visible).toBe(false)
    visible = nextJumpToBottomVisible({ atBottom: true, delta: 12, visible, settling: false })
    expect(visible).toBe(false)
  })

  it('reads a session unread count', () => {
    expect(sessionUnreadCount({ unread: 23 })).toBe(23)
    expect(sessionUnreadCount({ unread: 0 })).toBe(0)
    expect(sessionUnreadCount(undefined)).toBe(0)
  })

  it('finds the first incoming unread message from the end', () => {
    const list = [
      { message_id: 'a', sender: { user_id: 1 } },
      { message_id: 'b', sender: { user_id: 2 } },
      { message_id: 'me', sender: { user_id: 9 } },
      { message_id: 'c', sender: { user_id: 2 } },
      { message_id: 'd', sender: { user_id: 3 } },
    ]
    expect(firstUnreadMessage(list, 2, 9)?.message_id).toBe('c')
    expect(firstUnreadMessage(list, 3, 9)?.message_id).toBe('b')
    expect(firstUnreadMessage(list, 0, 9)).toBeNull()
  })

  it('treats a missing unread target as above the viewport', () => {
    const box = (top: number) => ({ getBoundingClientRect: () => ({ top }) })
    expect(isElementAboveContainer(null, box(10))).toBe(true)
    expect(isElementAboveContainer(box(0), box(40))).toBe(true)
    expect(isElementAboveContainer(box(48), box(40))).toBe(false)
  })
})
