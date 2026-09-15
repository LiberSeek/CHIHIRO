import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const msgBody = readFileSync(new URL('./src/components/user/UserMsgBody.vue', import.meta.url), 'utf8')
const noticeBody = readFileSync(new URL('./src/components/user/UserNoticeBody.vue', import.meta.url), 'utf8')

describe('IM message bubble layout contract', () => {
  it('grows bubbles up from the avatar with a Telegram appendix', () => {
    expect(msgBody).toContain('align-items: flex-end')
    expect(msgBody).toContain("align-self: flex-end")
    expect(msgBody).not.toContain('margin-top: 8px !important')
    expect(msgBody).toContain("'has-tail': hasBubbleTail()")
    expect(msgBody).toContain('function hasBubbleTail()')
    expect(msgBody).toContain('if (!lastInGroup) return false')
    expect(msgBody).toContain('if (isBareImageMsg()) return false')
    expect(msgBody).toContain('if (isSuperFaceMsg()) return false')
    expect(msgBody).toContain('border-bottom-left-radius: 4px !important')
    expect(msgBody).toContain('border-bottom-right-radius: 4px !important')
    expect(msgBody).toContain('chihiro-bubble-appendix')
    expect(msgBody).toContain('M3 17h6V0c-.193 2.84-.876 5.767-2.05 8.782-.904 2.325-2.446 4.485-4.625 6.48A1 1 0 003 17z')
    expect(msgBody).toContain('left: -6px')
    expect(msgBody).toContain('right: -6px')
    expect(msgBody).toContain('bottom: -3px')
    expect(msgBody).toContain('transform: scaleX(-1)')
    expect(msgBody).not.toContain('--chihiro-bubble-tail:')
  })

  it('collapses consecutive same-sender messages like Telegram', () => {
    expect(msgBody).toContain("'first-in-group': firstInGroup")
    expect(msgBody).toContain("'last-in-group': lastInGroup")
    expect(msgBody).toContain("firstInGroup && type != 'body'")
    expect(msgBody).toContain("'is-placeholder': !lastInGroup")
    expect(msgBody).toContain('.message > img.is-placeholder')
    expect(msgBody).toContain('#base-app .message.first-in-group')
    expect(msgBody).toContain('padding-top: 12px')
    expect(msgBody).toContain('margin-top: 10px')
  })

  it('puts HH:MM at the end of each bubble like Telegram', () => {
    expect(msgBody).toContain('chihiro-msg-time')
    expect(msgBody).toContain('chihiro-msg-time-spacer')
    expect(msgBody).toContain('formatBubbleTime(data.time)')
    expect(msgBody).toContain('font-variant-numeric: tabular-nums')
  })

  it('renders chat date chips as 今天 / 昨天 / 周X', () => {
    expect(noticeBody).toContain('formatChatDateChip(data.time)')
    expect(noticeBody).not.toContain('getTimeConfig(new Date(data.time * 1000))')
  })

  it('puts the multi-select check on the left like WeChat desktop', () => {
    expect(msgBody).toContain('v-if="selecting && type != \'body\'"')
    expect(msgBody).toContain(':class="{ on: selected }"')
    expect(msgBody).not.toContain('v-if="selected && type != \'body\'"')
    expect(msgBody).toContain('padding-left: 36px !important')
    expect(msgBody).not.toContain('padding-right: 36px')
    expect(msgBody).toContain('left: 8px')
    expect(msgBody).not.toContain('right: 4px')
    expect(msgBody).toContain('#base-app .message > .chihiro-msg-check')
    expect(msgBody).toContain('.message.last-in-group > .chihiro-msg-check')
    expect(msgBody).toContain('align-self: flex-end')
    expect(msgBody).toContain('height: 28px')
    expect(msgBody).toContain('bottom: 4px')
    expect(msgBody).toContain('color-mix(in srgb, var(--color-font) 8%, transparent)')
    expect(msgBody).not.toContain('background: transparent !important;\n    backdrop-filter: none !important;')
  })
})
