import { describe, expect, it } from 'vitest'
import {
    gatewayImageProxyUrl,
    isImageProxyUrl,
    isQqMediaHost,
    rewriteWebMediaUrl,
    unwrapMediaUrl,
} from './media-url'

describe('rewriteWebMediaUrl', () => {
    it('sends QQ CDN images through the gateway proxy', () => {
        const src = 'https://multimedia.nt.qq.com.cn/download?appid=1407&fileid=abc&rkey=xyz'
        expect(rewriteWebMediaUrl(src)).toBe(gatewayImageProxyUrl(src))
        expect(rewriteWebMediaUrl('https://gchat.qpic.cn/gchatpic_new/0/0-0-ABCDEF/0'))
            .toBe(gatewayImageProxyUrl('https://gchat.qpic.cn/gchatpic_new/0/0-0-ABCDEF/0'))
        expect(rewriteWebMediaUrl('https://q1.qlogo.cn/g?b=qq&s=0&nk=10000'))
            .toBe(gatewayImageProxyUrl('https://q1.qlogo.cn/g?b=qq&s=0&nk=10000'))
    })

    it('leaves local, data, and already-proxied urls alone', () => {
        expect(rewriteWebMediaUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc')
        expect(rewriteWebMediaUrl('blob:http://127.0.0.1:3100/1')).toBe('blob:http://127.0.0.1:3100/1')
        expect(rewriteWebMediaUrl('/files/cache/a.png')).toBe('/files/cache/a.png')
        expect(rewriteWebMediaUrl('http://127.0.0.1:6099/files/a.png')).toBe('http://127.0.0.1:6099/files/a.png')
        const proxied = gatewayImageProxyUrl('https://gchat.qpic.cn/x')
        expect(rewriteWebMediaUrl(proxied)).toBe(proxied)
        expect(isImageProxyUrl(proxied)).toBe(true)
    })

    it('unwraps gateway proxy urls', () => {
        const src = 'https://gchat.qpic.cn/gchatpic_new/0/0-0-ABCDEF/0'
        expect(unwrapMediaUrl(rewriteWebMediaUrl(src))).toBe(src)
        expect(unwrapMediaUrl(src)).toBe(src)
    })

    it('matches the runtime host allowlist', () => {
        expect(isQqMediaHost('multimedia.nt.qq.com.cn')).toBe(true)
        expect(isQqMediaHost('example.com')).toBe(false)
    })
})
