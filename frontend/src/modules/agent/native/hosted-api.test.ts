import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { chatApi, configureApiBase, fileApi } from './src/api/v1'
import { httpClient, setupHttpClient } from './src/api/http'

const requests: InternalAxiosRequestConfig[] = []
let previousAdapter: typeof httpClient.defaults.adapter

beforeEach(() => {
  requests.length = 0
  previousAdapter = httpClient.defaults.adapter
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => 'host-token'), removeItem: vi.fn() })
  vi.stubGlobal('window', { location: { origin: 'http://localhost', hash: '#/next/agent' } })
  configureApiBase(true)
  setupHttpClient()
  httpClient.defaults.adapter = (async config => {
    requests.push(config)
    return { data: { status: 'ok', data: [] }, status: 200, statusText: 'OK', headers: {}, config }
  }) satisfies AxiosAdapter
})

afterEach(() => {
  httpClient.defaults.adapter = previousAdapter
  vi.unstubAllGlobals()
})

describe('native hosted API with the real generated client', () => {
  it('routes sessions, stop, projects and files through the Gateway without the host token', async () => {
    await chatApi.listSessions()
    await chatApi.stopSession('session/a')
    await chatApi.listProjects()
    expect(requests.map(config => httpClient.getUri(config))).toEqual([
      '/astrbot/api/v1/chat/sessions',
      '/astrbot/api/v1/chat/sessions/session%2Fa/stop',
      '/astrbot/api/v1/chat/projects',
    ])
    expect(requests.map(config => config.method)).toEqual(['get', 'post', 'get'])
    for (const config of requests) expect(config.headers.get('Authorization')).toBeUndefined()
    expect(chatApi.sendStreamUrl()).toBe('/astrbot/api/v1/chat')
    expect(fileApi.contentUrl('file/a')).toBe('/astrbot/api/v1/files/file%2Fa/content')
  })

  it('keeps host login and storage intact after an AstrBot authentication failure', async () => {
    httpClient.defaults.adapter = async config => {
      throw new AxiosError('Expired AstrBot credential', 'ERR_BAD_REQUEST', config, undefined, {
        status: 401, statusText: 'Unauthorized', data: {}, headers: {}, config,
      })
    }
    await expect(chatApi.listSessions()).rejects.toMatchObject({ response: { status: 401 } })
    expect(localStorage.removeItem).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('#/next/agent')
    expect(httpClient).not.toBe(axios)
  })
})
