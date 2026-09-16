const PLUS_ONE_TYPES = new Set(['text', 'at', 'face'])

function isChatMessage(item: {
  post_type?: string
  revoke?: boolean
  fake_msg?: boolean
  raw_message?: string
} | null | undefined): boolean {
  if (!item || item.revoke || item.fake_msg) return false
  if (item.post_type && item.post_type !== 'message' && item.post_type !== 'message_sent') return false
  const raw = String(item.raw_message || '')
  if (raw.includes('已删除')) return false
  return true
}

type PlusOneSeg = {
  type?: string
  text?: string
  qq?: string | number
  id?: string | number
  url?: string
}

export function plusOneContentKey(msg: {
  message?: Array<PlusOneSeg>
} | null | undefined): string | null {
  const segs = Array.isArray(msg?.message) ? msg.message : []
  if (!segs.length) return null
  if (!segs.every((seg) => seg && PLUS_ONE_TYPES.has(String(seg.type || '')))) return null
  const text = segs.map((seg) => {
    if (seg.type === 'text') return String(seg.text ?? '')
    if (seg.type === 'at') return `@${seg.qq ?? seg.text ?? ''}`
    if (seg.type === 'face') return `[face:${seg.id ?? ''}]`
    return ''
  }).join('').replace(/\s+/g, ' ').trim()
  return text || null
}

function neighborChatMessage<T>(list: T[], from: number, step: 1 | -1): T | null {
  for (let i = from + step; i >= 0 && i < list.length; i += step) {
    const item = list[i]
    if (!isChatMessage(item as { post_type?: string })) continue
    return item
  }
  return null
}

export function shouldShowPlusOne<T extends {
  post_type?: string
  revoke?: boolean
  fake_msg?: boolean
  raw_message?: string
  message?: Array<PlusOneSeg>
}>(list: T[] = [], index: number): boolean {
  const cur = list[index]
  const key = plusOneContentKey(cur)
  if (!key || !isChatMessage(cur)) return false
  if (neighborChatMessage(list, index, 1)) return false
  const prev = neighborChatMessage(list, index, -1)
  return !!prev && plusOneContentKey(prev) === key
}

export function plusOneSendSegments(msg: {
  message?: Array<PlusOneSeg>
} | null | undefined): Array<Record<string, unknown>> | null {
  if (!plusOneContentKey(msg)) return null
  const out: Array<Record<string, unknown>> = []
  for (const seg of msg?.message ?? []) {
    if (seg.type === 'text') out.push({ type: 'text', text: String(seg.text ?? '') })
    else if (seg.type === 'at') out.push({ type: 'at', qq: seg.qq, text: seg.text })
    else if (seg.type === 'face') out.push({ type: 'face', id: seg.id })
  }
  return out
}
