/**
 * Where the API lives. VITE_API_URL is set at build time when the frontend is hosted on another
 * origin (for example https://api.example.com); empty means same origin, which is what the Vite dev
 * proxy and a single-host setup use.
 */
const raw = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').trim()

export const API_BASE = raw.replace(/\/+$/, '')

/** True when the API is on a different origin from this page. */
export const crossOrigin = (() => {
  if (!API_BASE) return false
  try { return new URL(API_BASE, location.href).origin !== location.origin } catch { return false }
})()

/** Absolute URL for an API path such as `/api/sim` or a server-issued image path. */
export function apiUrl(path: string) {
  return /^(https?:|blob:|data:)/i.test(path) ? path : API_BASE + path
}

/** WebSocket URL on the API origin (wss when the API is https). */
export function socketUrl(session?: string | null) {
  const url = new URL(API_BASE || location.origin, location.href)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = url.pathname.replace(/\/$/, '') + '/ws'
  url.search = ''
  url.hash = ''
  if (session) url.searchParams.set('session', session)
  return url.toString()
}

const STORAGE_KEY = 'metro:session'
let memoryToken: string | null = (() => {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
})()
let fallbackWanted = crossOrigin || !!memoryToken

/**
 * Cookie-less session fallback. Browsers that block third-party cookies never send the API cookie
 * to another origin, so the session token is also kept here and sent as a header.
 */
export const session = {
  get token() { return memoryToken },
  /** Ask the server to return the token on sign-in (always when cross-origin, or after a blocked cookie). */
  get wanted() { return fallbackWanted },
  want() { fallbackWanted = true },
  store(token: string | null | undefined) {
    if (!token) return
    memoryToken = token
    try { localStorage.setItem(STORAGE_KEY, token) } catch { /* The in-memory token still works for this visit. */ }
  },
  forget() {
    memoryToken = null
    fallbackWanted = crossOrigin
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* Nothing stored. */ }
  },
  /** True when the token survives a reload. */
  get persistent() {
    try { return localStorage.getItem(STORAGE_KEY) === memoryToken } catch { return false }
  },
}

/** Headers that carry the fallback session, merged into every API request. */
export function sessionHeaders(): Record<string, string> {
  return memoryToken ? { 'X-Metro-Session': memoryToken } : {}
}

/** fetch() against the API origin with credentials and the fallback session header. */
export function apiFetch(path: string, init: RequestInit = {}) {
  return fetch(apiUrl(path), {
    ...init,
    credentials: 'include',
    headers: { ...sessionHeaders(), ...(init.headers as Record<string, string> | undefined) },
  })
}
