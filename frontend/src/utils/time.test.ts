import { describe, it, expect, afterEach, vi } from 'vitest'
import { formatTimeDisplay, formatDateDisplay } from './time'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('formatTimeDisplay', () => {
  it('formats an ISO datetime as a locale-aware hour and minute', () => {
    expect(formatTimeDisplay('2026-01-15T14:30:00', 'de-DE')).toBe('14:30')
    expect(formatTimeDisplay('2026-01-15T14:30:00', 'en-GB')).toBe('14:30')
  })

  it('pads single-digit hours', () => {
    expect(formatTimeDisplay('2026-01-15T09:05:00', 'de-DE')).toBe('09:05')
  })

  it('formats the next-day datetimes that GTFS times past midnight normalize to', () => {
    expect(formatTimeDisplay('2024-01-16T01:30:00', 'de-DE')).toBe('01:30')
  })

  it('reads the timestamp as local time, not UTC', () => {
    vi.stubEnv('TZ', 'America/New_York')
    expect(formatTimeDisplay('2026-01-15T14:30:00', 'de-DE')).toBe('14:30')
  })
})

describe('formatDateDisplay', () => {
  it('formats a YYYY-MM-DD string for the locale', () => {
    expect(formatDateDisplay('2026-03-01', 'de-DE')).toBe('1.3.2026')
    expect(formatDateDisplay('2026-03-01', 'en-CA')).toBe('2026-03-01')
  })

  it('keeps the calendar day in a timezone behind UTC', () => {
    // Parsing the string with `new Date('2026-03-01')` would land on UTC
    // midnight and render as 2026-02-28 here.
    vi.stubEnv('TZ', 'America/New_York')
    expect(formatDateDisplay('2026-03-01', 'en-CA')).toBe('2026-03-01')
  })

  it('returns the input unchanged when a component is missing or unparseable', () => {
    for (const invalid of ['', '2026-03', 'garbage', '2026-03-00', '0000-03-01']) {
      expect(formatDateDisplay(invalid, 'de-DE')).toBe(invalid)
    }
  })

  it('does not validate out-of-range components, it rolls them over', () => {
    expect(formatDateDisplay('2026-13-01', 'en-CA')).toBe('2027-01-01')
  })
})
