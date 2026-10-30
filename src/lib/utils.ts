import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(value?: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...opts,
  }).format(d)
}

export function formatDateTime(value?: string | null) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function relativeTime(value?: string | null) {
  if (!value) return null
  const d = new Date(value).getTime()
  if (Number.isNaN(d)) return null
  const diff = Date.now() - d
  const mins = Math.round(diff / 60000)
  if (Math.abs(mins) < 1) return 'just now'
  if (Math.abs(mins) < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (Math.abs(hours) < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return `${days}d ago`
  return formatDate(value) ?? null
}

export function truncate(text: string, max = 160) {
  if (text.length <= max) return text
  return `${text.slice(0, max).trimEnd()}…`
}

export function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return null
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`
}

export function hostnameOf(url?: string | null) {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export function isLikelyUrl(value: string) {
  try {
    const u = new URL(value.trim())
    return (u.protocol === 'http:' || u.protocol === 'https:') && Boolean(u.hostname.includes('.'))
  } catch {
    return false
  }
}

export function plural(count: number, singular: string, pluralForm?: string) {
  return count === 1 ? singular : (pluralForm ?? `${singular}s`)
}

export function pct(numerator: number, denominator: number) {
  if (!denominator) return 0
  return Math.round((numerator / denominator) * 100)
}

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
