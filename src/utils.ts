// HiveConfig.apiUrl is either the API's own host (https://api.hornethive.io)
// or the app origin of a self-hosted Hive (https://yourdomain.com or
// http://localhost:3000).
//   - The API's host (its name starts with "api.") serves versioned paths:
//     /v1 is added when apiUrl has no path, and a path given (…/v1, …/v2)
//     is kept.
//   - An app origin mounts every route under /api (cmd/server/main.go:
//     api := app.Group("/api")); /api is added here once.
export const API_VERSION = 'v1'

export function apiBase(apiUrl: string): string {
  const base = apiUrl.replace(/\/+$/, '')
  let url: URL | null = null
  try {
    url = new URL(base)
  } catch {
    // not a full URL: treat it as an app origin
  }
  if (url && url.hostname.startsWith('api.')) {
    return url.pathname === '/' || url.pathname === '' ? `${base}/${API_VERSION}` : base
  }
  return base + '/api'
}

/** HiveError carries the HTTP status and the API's error message. */
export class HiveError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'HiveError'
    this.status = status
    this.body = body
  }
}

/**
 * request sends one call to Hive's API and returns the parsed JSON body. A
 * non-2xx answer throws HiveError with the API's `error` message, whether or
 * not the body is JSON.
 */
export async function request<T>(url: string, init: RequestInit, fallbackMessage: string): Promise<T> {
  return (await requestWithHeaders<T>(url, init, fallbackMessage)).body
}

/** requestWithHeaders is request, and the response's headers too. */
export async function requestWithHeaders<T>(url: string, init: RequestInit, fallbackMessage: string): Promise<{ body: T; headers: Headers }> {
  const response = await fetch(url, init)
  const text = await response.text()
  let body: unknown = undefined
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : fallbackMessage
    throw new HiveError(message, response.status, body)
  }
  return { body: body as T, headers: response.headers }
}

/** Storage holds the session token. */
export interface Storage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/**
 * memoryStorage keeps the session token in memory, everywhere. The token
 * signs in to the whole Hive account, so it is not written to localStorage,
 * where any script on the page could read it; a page that wants it to
 * survive a reload passes `storage: localStorage` and takes that on.
 */
export function memoryStorage(): Storage {
  const memory = new Map<string, string>()
  return {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => void memory.set(key, value),
    removeItem: (key) => void memory.delete(key),
  }
}
