import axios, {
  type AxiosError,
  type AxiosStatic,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import type { ResolvedAgentApiBase } from '../api-base';

const AUTH_HEADER = 'Authorization';
const LOCALE_HEADER = 'Accept-Language';

let configured = false;
let hosted = false;

// The generated 0.2 client requires AxiosStatic but invokes only the callable
// request interface. Preserve static helpers on a private instance for compatibility.
export const httpClient = Object.assign(axios.create(), {
  Axios: axios.Axios, AxiosError: axios.AxiosError, AxiosHeaders: axios.AxiosHeaders,
  Cancel: axios.Cancel, CancelToken: axios.CancelToken, CanceledError: axios.CanceledError,
  isCancel: axios.isCancel, isAxiosError: axios.isAxiosError,
  toFormData: axios.toFormData, formToJSON: axios.formToJSON,
  all: axios.all, spread: axios.spread, mergeConfig: axios.mergeConfig,
  getAdapter: axios.getAdapter, HttpStatusCode: axios.HttpStatusCode,
  VERSION: axios.VERSION, create: axios.create,
}) as AxiosStatic;
export const apiV1Client = axios.create({ baseURL: '/api/v1' });

export function isHosted(): boolean {
  return hosted;
}

export function configureHttpClient(configuration: ResolvedAgentApiBase) {
  hosted = configuration.hosted;
  apiV1Client.defaults.baseURL = configuration.apiV1Base;
}

function getToken(): string | null {
  return hosted ? null : localStorage.getItem('token');
}

function getLocale(): string | null {
  return localStorage.getItem('astrbot-locale');
}

function setAxiosHeader(
  headers: InternalAxiosRequestConfig['headers'],
  key: string,
  value: string,
) {
  if (typeof headers.set === 'function') {
    headers.set(key, value);
    return;
  }
  headers[key] = value;
}

function attachAxiosHeaders(config: InternalAxiosRequestConfig) {
  const token = getToken();
  if (token) setAxiosHeader(config.headers, AUTH_HEADER, `Bearer ${token}`);

  const locale = getLocale();
  if (locale) setAxiosHeader(config.headers, LOCALE_HEADER, locale);

  return config;
}

function normalizeAxiosError(error: AxiosError) {
  if (!hosted && error.response?.status === 401) {
    let requestPath = '';
    try {
      const url = error.config?.url || '';
      const baseURL = error.config?.baseURL;
      const resolvedUrl =
        url && baseURL && !/^([a-z][a-z\d+\-.]*:)?\/\//i.test(url)
          ? `${baseURL.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`
          : url;
      const requestUrl = new URL(resolvedUrl || '/', window.location.origin);
      if (requestUrl.origin === window.location.origin) requestPath = requestUrl.pathname;
    } catch {
      requestPath = '';
    }

    const isAuthChallenge =
      [
        '/api/auth/login',
        '/api/auth/setup',
        '/api/auth/setup-status',
        '/api/v1/auth/login',
        '/api/v1/auth/setup',
        '/api/v1/auth/setup-status',
      ].includes(requestPath) ||
      Boolean(
        (error.response.data as { data?: { totp_required?: boolean } } | undefined)?.data
          ?.totp_required,
      );

    if (requestPath.startsWith('/api/') && !isAuthChallenge) {
      [
        'user',
        'token',
        'change_pwd_hint',
        'md5_pwd_hint',
        'password_upgrade_required',
      ].forEach((key) => localStorage.removeItem(key));

      if (!window.location.hash.startsWith('#/auth/login')) window.location.hash = '/auth/login';
    }
  }

  if (error.response?.status === 429) {
    const data = error.response.data as { message?: string } | undefined;
    if (data?.message) return Promise.reject(data.message);
  }
  return Promise.reject(error);
}

function installAxiosInterceptors(instance: AxiosInstance) {
  instance.interceptors.request.use(attachAxiosHeaders);
  instance.interceptors.response.use((response) => response, normalizeAxiosError);
}

export function fetchWithAuth(input: RequestInfo | URL, init?: RequestInit) {
  const token = getToken();
  const locale = getLocale();

  if (!token && !locale) return window.fetch(input, init);

  const requestHeaders =
    typeof input !== 'string' && 'headers' in input ? (input as Request).headers : undefined;
  const headers = new Headers(init?.headers || requestHeaders);

  if (token && !headers.has(AUTH_HEADER)) headers.set(AUTH_HEADER, `Bearer ${token}`);
  if (locale && !headers.has(LOCALE_HEADER)) headers.set(LOCALE_HEADER, locale);

  return window.fetch(input, { ...init, headers });
}

export function setupHttpClient() {
  if (configured) return;
  installAxiosInterceptors(httpClient);
  installAxiosInterceptors(apiV1Client);
  configured = true;
}
