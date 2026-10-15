import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'
import { lineCounts, timeAgo } from './progress'

const t = ((key: string) => key) as unknown as TFunction
const now = new Date('2026-10-14T12:00:00Z').getTime()
const ago = (ms: number) => new Date(now - ms)

describe('timeAgo', () => {
  it('uses friendly relative times in both languages', () => {
    expect(timeAgo(ago(20_000), now, 'en', t)).toBe('teacher.justNow')
    expect(timeAgo(ago(3 * 60_000), now, 'en', t)).toBe('3 minutes ago')
    expect(timeAgo(ago(3 * 60_000), now, 'es', t)).toBe('hace 3 minutos')
    expect(timeAgo(ago(2 * 3_600_000), now, 'en', t)).toBe('2 hours ago')
    expect(timeAgo(undefined, now, 'en', t)).toBe('—')
  })
})

describe('lineCounts', () => {
  it('counts non-empty lines per file', () => {
    expect(lineCounts({ html: '<h1>Hi</h1>\n\n<p>x</p>\n', css: '', js: 'a()\n  \nb()' })).toEqual({ html: 2, css: 0, js: 2 })
  })
})
