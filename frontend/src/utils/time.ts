export function formatTimeDisplay(isoDateTime: string, locale: string): string {
  const date = new Date(isoDateTime)
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

// Format a "YYYY-MM-DD" date string to a locale-aware date. Parsed component-wise
// as a local date so it never shifts a day across time zones.
export function formatDateDisplay(isoDate: string, locale: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) {
    return isoDate
  }
  return new Date(year, month - 1, day).toLocaleDateString(locale)
}
