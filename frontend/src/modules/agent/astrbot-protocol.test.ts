import { describe, expect, it } from 'vitest'
import { buildChatRequestFlags, partToPayload, readSseStream } from './astrbot-protocol'
function stream(chunks: string[]) { const e = new TextEncoder(); return new ReadableStream<Uint8Array>({ start(c) { chunks.forEach((x) => c.enqueue(e.encode(x))); c.close() } }) }
describe('AstrBot protocol', () => {
  it('builds source flags', () => expect(buildChatRequestFlags(false)).toEqual({ enable_inline_genui: true, enable_default_system_prompt: true, enable_streaming: false }))
  it('serializes source message parts', () => { expect(partToPayload({ type: 'plain', text: 'hello' })).toEqual({ type: 'plain', text: 'hello' }); expect(partToPayload({ type: 'reply', message_id: 7, selected_text: 'quote' })).toEqual({ type: 'reply', message_id: 7, selected_text: 'quote' }); expect(partToPayload({ type: 'image', attachment_id: 'a1', filename: 'photo.png' })).toEqual({ type: 'image', attachment_id: 'a1', filename: 'photo.png' }) })
  it('parses multiline events split across chunks', async () => { const out: unknown[] = []; await readSseStream(stream(['data: {"type":"plain",\n', 'data: "data":"你好"}\n\ndata: {"type":"end"}\n\n']), (x) => out.push(x)); expect(out).toEqual([{ type: 'plain', data: '你好' }, { type: 'end' }]) })
})
