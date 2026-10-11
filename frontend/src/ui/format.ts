/** Same rule as the live site: 18000 → "18k", 1500 → "1.5k", 400 → "400". */
export function compact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n >= 1e4) return `${Math.round(n / 1e3)}k`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
  return String(n)
}

const nf = new Intl.NumberFormat('en-NG')

export function num(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return nf.format(n)
}

export function naira(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `₦${nf.format(Math.round(n))}`
}

/** "2d 4h 12m", adding seconds only inside the last hour. */
export function countdown(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  if (ms <= 0) return 'now'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${String(s % 60).padStart(2, '0')}s`
}

export function dateTime(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  try {
    return new Date(ms).toLocaleString('en-NG', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

/** 14 → "2pm", 0 or 24 → "12am". */
export function hourLabel(h: number): string {
  const hh = ((Math.round(h) % 24) + 24) % 24
  const suffix = hh < 12 ? 'am' : 'pm'
  const twelve = hh % 12 === 0 ? 12 : hh % 12
  return `${twelve}${suffix}`
}

export function hoursLabel(open: [number, number] | undefined): string | null {
  if (!open || open.length !== 2) return null
  const [a, b] = open
  if ((b - a + 24) % 24 === 0) return 'Open 24 hours'
  return `Open ${hourLabel(a)} – ${hourLabel(b)}`
}

/** Lagos is UTC+1 all year. */
export function lagosHour(now = new Date()): number {
  return (now.getUTCHours() + 1) % 24
}

export function isOpenNow(open: [number, number] | undefined, hour = lagosHour()): boolean | null {
  if (!open || open.length !== 2) return null
  const [a, b] = open
  if ((b - a + 24) % 24 === 0) return true
  return a < b ? hour >= a && hour < b : hour >= a || hour < b
}

/** "jollofChicken" → "Jollof chicken" */
export function humanize(id: string): string {
  const words = id
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()
    .toLowerCase()
  return words ? words[0].toUpperCase() + words.slice(1) : id
}

export function errorText(e: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (e instanceof TypeError) return "Can't reach the server right now. Try again in a moment."
  if (e instanceof Error && e.message) return e.message
  return fallback
}

/** Only http(s) links are rendered as anchors. */
export function safeHref(link: string | null | undefined): string | null {
  if (!link) return null
  try {
    const u = new URL(link)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

export function hostOf(link: string | null | undefined): string {
  const href = safeHref(link)
  if (!href) return link ?? '—'
  try {
    return new URL(href).hostname.replace(/^www\./, '')
  } catch {
    return href
  }
}
