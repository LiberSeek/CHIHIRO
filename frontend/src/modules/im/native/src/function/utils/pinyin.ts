export type PinYinData = { main: string[]; short: string[] }

let library: typeof import('pinyin') | undefined
let loading: Promise<boolean> | undefined

export function isPinyinReady() { return library !== undefined }

export function ensurePinyinLoaded(): Promise<boolean> {
    if (library) return Promise.resolve(true)
    return loading ??= import('pinyin').then(module => {
        library = module
        return true
    }).catch(() => {
        loading = undefined
        return false
    })
}

export function preloadPinyin() { void ensurePinyinLoaded() }

export function getPinyin(name: string): PinYinData {
    if (!library) return { main: [], short: [] }
    const convert = library.pinyin
    return {
        main: convert(name, { heteronym: true, compact: true, style: 'normal' })
            .map(item => item.join('').toLowerCase()),
        short: convert(name, { heteronym: true, compact: true, style: 'first_letter' })
            .map(item => item.join('').toLowerCase()),
    }
}

export function matchPinyin(data: PinYinData, query: string): boolean {
    const search = query.toLowerCase()
    return [...data.main, ...data.short].some(value => value.includes(search))
}
