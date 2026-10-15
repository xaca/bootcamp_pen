import type { TFunction } from 'i18next'
import type { Code } from '../shared/types'

/** A student counts as "active now" if they saved in the last 2 minutes. */
export const ACTIVE_MS = 2 * 60_000

/** Non-empty lines per file — a rough sense of how far a student has got. */
export function lineCounts({ html, css, js }: Code) {
  const count = (text: string) => text.split('\n').filter((line) => line.trim()).length
  return { html: count(html), css: count(css), js: count(js) }
}

/** "just now", "3 minutes ago", "2 hours ago", or a date for older saves. */
export function timeAgo(date: Date | undefined, now: number, lang: string, t: TFunction): string {
  if (!date) return '—'
  const seconds = Math.max(0, (now - date.getTime()) / 1000)
  if (seconds < 60) return t('teacher.justNow')
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), 'minute')
  if (seconds < 86_400) return rtf.format(-Math.floor(seconds / 3600), 'hour')
  return date.toLocaleString(lang, { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
