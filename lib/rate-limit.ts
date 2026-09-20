// Shared rate limiter for public and cost-sensitive endpoints.
//
// Backed by Postgres (`rate_limits` + the check_rate_limit RPC, see
// migrations/020_add_rate_limits.sql) rather than process memory. Vercel runs
// many function instances and recycles them constantly, so the in-memory
// version this replaces allowed roughly (limit × live instances) and reset
// every cold start.
//
// Fails CLOSED: if the limit can't be verified, the request is denied. That
// costs nothing in availability terms — every route using this already needs
// Supabase to do its actual work, so a database outage takes the endpoint down
// either way — and it keeps a database blip from turning into unbounded spend
// on the paid generation paths.

import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  retryAfterSeconds: number
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

/**
 * Fixed-window counter keyed by `${name}:${key}`, shared across every instance.
 * Returns ok:false once `limit` requests have been made inside `windowMs`.
 *
 * `key` is usually an IP (public routes) or a user id (authenticated ones).
 */
export async function checkRateLimit(
  name: string,
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  try {
    const { data, error } = await adminClient().rpc('check_rate_limit', {
      p_key: `${name}:${key}`,
      p_limit: limit,
      p_window_ms: windowMs,
    })
    if (error) throw new Error(error.message)

    const row = Array.isArray(data) ? data[0] : data
    if (!row) throw new Error('check_rate_limit returned no row')

    return {
      ok: Boolean(row.allowed),
      remaining: row.remaining ?? 0,
      retryAfterSeconds: row.retry_after_seconds ?? 0,
    }
  } catch (err) {
    console.error('[rate-limit] check failed, denying request:', err)
    return { ok: false, remaining: 0, retryAfterSeconds: 60 }
  }
}

/**
 * Give back a slot taken by {@link checkRateLimit}.
 *
 * For endpoints where the cost lands partway through the request, reserve the
 * slot up front and release it if the request fails before spending anything.
 * Reserving first is what keeps concurrent requests from all passing the check
 * at once; releasing on failure is what stops a bad URL from burning a real
 * user's quota. Best-effort — a failed release only costs one extra slot.
 */
export async function releaseRateLimit(name: string, key: string): Promise<void> {
  try {
    const { error } = await adminClient().rpc('release_rate_limit', {
      p_key: `${name}:${key}`,
    })
    if (error) throw new Error(error.message)
  } catch (err) {
    console.error('[rate-limit] release failed:', err)
  }
}

/** Human-friendly "3h" / "2 days" rendering for a retry-after duration. */
export function formatRetryAfter(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.ceil(seconds / 60)
  if (mins < 60) return `${mins} min`
  const hours = Math.ceil(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.ceil(hours / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}
