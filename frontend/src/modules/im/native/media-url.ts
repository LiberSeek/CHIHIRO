export const IMAGE_PROXY_PATH = '/api/runtime/image-proxy'

export function isQqMediaHost(host: string): boolean {
    const name = String(host || '').toLowerCase()
    return (
        name === 'multimedia.nt.qq.com.cn' ||
        name.endsWith('.qq.com') ||
        name.endsWith('.qq.com.cn') ||
        name.endsWith('.qpic.cn') ||
        name.endsWith('.qlogo.cn') ||
        name.endsWith('.gtimg.cn')
    )
}

function parseUrl(url: string): URL | null {
    try {
        if (url.startsWith('/')) return new URL(url, 'http://chihiro.local')
        return new URL(url)
    } catch {
        return null
    }
}

export function isImageProxyUrl(url: string): boolean {
    return parseUrl(url)?.pathname === IMAGE_PROXY_PATH
}

export function gatewayImageProxyUrl(url: string): string {
    return `${IMAGE_PROXY_PATH}?url=${encodeURIComponent(url)}`
}

export function rewriteWebMediaUrl(url: string): string {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url
    if (isImageProxyUrl(url)) return url
    const parsed = parseUrl(url)
    if (!parsed) return url
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return url
    if (!isQqMediaHost(parsed.hostname)) return url
    return gatewayImageProxyUrl(parsed.href)
}

export function unwrapMediaUrl(url: string): string {
    if (!url) return url
    const parsed = parseUrl(url)
    if (!parsed || parsed.pathname !== IMAGE_PROXY_PATH) return url
    return parsed.searchParams.get('url') || url
}
