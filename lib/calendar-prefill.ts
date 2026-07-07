// Shared session-scoped handoff for the calendar → generator flow.
// Calendar "Create now" writes a DailySuggestion here; the target
// generator reads it on mount, prefills its form, and clears the key
// so refreshes don't reapply stale values.

import type { DailySuggestion } from './planner'

const KEY = 'calendarPrefill'

export function savePrefill(suggestion: DailySuggestion) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(KEY, JSON.stringify(suggestion))
  } catch { /* quota / private mode — silently ignore */ }
}

export function readPrefill(expectedType?: DailySuggestion['contentType']): DailySuggestion | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DailySuggestion
    if (expectedType && parsed.contentType !== expectedType) return null
    sessionStorage.removeItem(KEY)
    return parsed
  } catch {
    sessionStorage.removeItem(KEY)
    return null
  }
}
