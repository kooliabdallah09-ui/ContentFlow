// Reading performance out of how long an ad survives.
//
// Brands stop paying for ads that don't work, and commercial ads drop out of
// Meta's Ad Library the moment they're switched off. So "still running" is a
// performance signal that costs nothing to collect and doesn't depend on
// anyone volunteering their ROAS.

export type AdVerdict = 'testing' | 'working' | 'proven' | 'died-fast' | 'retired'

// Days a competitor keeps paying before the result means something. Under a
// week tells you nothing — that's a normal test window. Past a month a brand
// has had every chance to kill it and chose not to.
const WORKING_AFTER_DAYS = 7
const PROVEN_AFTER_DAYS = 30
// An ad pulled this fast was a losing test, not a campaign.
const DIED_FAST_DAYS = 7

export function daysLive(firstSeenAt: string, diedAt?: string | null): number {
  const start = new Date(firstSeenAt).getTime()
  const end = diedAt ? new Date(diedAt).getTime() : Date.now()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.max(0, Math.floor((end - start) / 86_400_000))
}

export function verdictFor(firstSeenAt: string, diedAt?: string | null): AdVerdict {
  const days = daysLive(firstSeenAt, diedAt)
  if (diedAt) return days < DIED_FAST_DAYS ? 'died-fast' : 'retired'
  if (days >= PROVEN_AFTER_DAYS) return 'proven'
  if (days >= WORKING_AFTER_DAYS) return 'working'
  return 'testing'
}

export const VERDICT_LABEL: Record<AdVerdict, string> = {
  testing:     'Watching',
  working:     'Holding up',
  proven:      'Proven winner',
  'died-fast': 'Failed test',
  retired:     'Retired',
}

export const VERDICT_HINT: Record<AdVerdict, string> = {
  testing:     'Too early to read — most tests run about a week.',
  working:     'Past the usual test window and still running.',
  proven:      'A month of spend and still live. Worth copying the structure.',
  'died-fast': 'Pulled inside a week — they stopped paying for it.',
  retired:     'Had a real run, now switched off.',
}

/**
 * Days since the last confirmation. Drives the nudge to re-check, since a
 * watchlist nobody confirms decays into a list of ads that may or may not
 * still exist.
 */
export function daysSinceCheck(lastConfirmedAt: string): number {
  const t = new Date(lastConfirmedAt).getTime()
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}

export function needsCheck(lastConfirmedAt: string, diedAt?: string | null): boolean {
  if (diedAt) return false
  return daysSinceCheck(lastConfirmedAt) >= 7
}
