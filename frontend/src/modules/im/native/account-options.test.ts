import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
vi.mock('./src/runtime/backend', () => ({ backend: { type: 'web', isDesktop: () => false } }))
vi.mock('./src/function/utils/appUtil', () => ({}))
vi.mock('./src/function/msg', () => ({ dispatch: vi.fn() }))
import { selectNativeAccountOptions, saveAll } from './src/function/option'
import { useSettingsStore } from './src/state/settings'

const storage = new Map<string, string>()
beforeEach(() => {
  setActivePinia(createPinia())
  storage.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  })
})
afterEach(() => vi.unstubAllGlobals())

it('keeps notification and pinned session settings independent per account', () => {
  selectNativeAccountOptions('qq:10001')
  saveAll({ top_info: { '20001': true }, notice_group: {}, session_notice: { 'group:3': 'mute' }, language: 'zh-CN' })
  selectNativeAccountOptions('qq:10002')
  expect(useSettingsStore().sysConfig.top_info).toEqual({})
  expect(useSettingsStore().sysConfig.session_notice).toEqual({})
  selectNativeAccountOptions('qq:10001')
  expect(useSettingsStore().sysConfig.top_info).toEqual({ '20001': true })
  expect(useSettingsStore().sysConfig.session_notice).toEqual({ 'group:3': 'mute' })
  selectNativeAccountOptions()
  expect(useSettingsStore().sysConfig.top_info).toEqual({})
})

it('does not overwrite the legacy frontend settings or copy account data to global settings', () => {
  storage.set('options', 'top_info:legacy&language:en')
  selectNativeAccountOptions('qq:10001')
  saveAll({ top_info: { '20001': true }, language: 'zh-CN' })
  expect(storage.get('options')).toBe('top_info:legacy&language:en')
  expect(storage.get('chihiro:im:options')).toBe('language:zh-CN')
})
