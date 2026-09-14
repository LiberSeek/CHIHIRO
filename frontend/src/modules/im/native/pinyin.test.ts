import { expect, it } from 'vitest'
import { ensurePinyinLoaded, getPinyin, matchPinyin } from './src/function/utils/pinyin'

it('loads bundled Chinese search transliteration without a remote script', async () => {
  expect(await ensurePinyinLoaded()).toBe(true)
  const data = getPinyin('客户')
  expect(matchPinyin(data, 'kehu')).toBe(true)
  expect(matchPinyin(data, 'kh')).toBe(true)
})
