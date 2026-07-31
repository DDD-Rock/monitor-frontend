import type { ApiError } from '../types/api'

const TOKEN_KEY = 'autobuff-monitor-token'
const TOKEN_EXPIRES_KEY = 'autobuff-monitor-token-expires-at'
let memoryAccessToken: string | null = null
let memoryExpiresAt: number | null = null

function storageGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function storageSet(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value)
  } catch {
    // 隐私模式或浏览器禁用存储时，当前页面仍可继续使用内存外的既有行为。
  }
}

function storageRemove(storage: Storage, key: string): void {
  try {
    storage.removeItem(key)
  } catch {
    // 存储不可用时无需继续处理。
  }
}

function tokenExpiresAt(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const decoded = JSON.parse(atob(normalized)) as { exp?: number }
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null
  } catch {
    return null
  }
}

export function getAccessToken(): string | null {
  let token = memoryAccessToken ?? storageGet(localStorage, TOKEN_KEY)
  if (!token) {
    token = storageGet(sessionStorage, TOKEN_KEY)
    if (token) {
      storageSet(localStorage, TOKEN_KEY, token)
      const expiresAt = tokenExpiresAt(token)
      if (expiresAt) storageSet(localStorage, TOKEN_EXPIRES_KEY, String(expiresAt))
      storageRemove(sessionStorage, TOKEN_KEY)
    }
  }
  if (!token) return null

  const storedExpiresAt = memoryExpiresAt ?? Number(storageGet(localStorage, TOKEN_EXPIRES_KEY))
  const expiresAt = storedExpiresAt > 0 ? storedExpiresAt : tokenExpiresAt(token)
  if (expiresAt && expiresAt <= Date.now()) {
    setAccessToken(null)
    return null
  }
  if (expiresAt && storedExpiresAt <= 0) {
    storageSet(localStorage, TOKEN_EXPIRES_KEY, String(expiresAt))
  }
  memoryAccessToken = token
  memoryExpiresAt = expiresAt
  return token
}

export function setAccessToken(token: string | null, expiresAt?: number): void {
  if (token) {
    memoryAccessToken = token
    storageSet(localStorage, TOKEN_KEY, token)
    const resolvedExpiresAt = expiresAt ?? tokenExpiresAt(token)
    memoryExpiresAt = resolvedExpiresAt
    if (resolvedExpiresAt) {
      storageSet(localStorage, TOKEN_EXPIRES_KEY, String(resolvedExpiresAt))
    } else {
      storageRemove(localStorage, TOKEN_EXPIRES_KEY)
    }
  } else {
    memoryAccessToken = null
    memoryExpiresAt = null
    storageRemove(localStorage, TOKEN_KEY)
    storageRemove(localStorage, TOKEN_EXPIRES_KEY)
  }
  storageRemove(sessionStorage, TOKEN_KEY)
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(path, { ...init, headers })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null
    throw new Error(body?.message ?? `请求失败（${response.status}）`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
