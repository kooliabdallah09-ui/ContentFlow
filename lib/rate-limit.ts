// Shared in-memory IP rate limiter for public (signed-out) endpoints.
//
// Vercel serverless instances don't share memory, so a determined user can
// get roughly (limit × instance count) requests. That's acceptable for the
// endpoints using this — each one is cheap and the limit exists to stop
// runaway cost on a traffic spike, not to be airtight. Move to Vercel KV if
// real abuse shows up.
//
// Existing in-route limiter in /api/preview/generate predates this helper and
// still has its own copy; new public routes should use this.

import type { NextRequest } from 'next/server'

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

interface Bucket {
  count: number
  resetAt: number
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  retryAfterSeconds: number
}

/**
 * Fixed-window counter keyed by `${name}:${ip}`. Returns ok:false once `limit`
 * requests have been made inside `windowMs`.
 */
export function checkRateLimit(
  name: string,
  ip: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const store = getStore(name)
  const now = Date.now()

  // Keep the map bounded — sweep expired buckets when it grows.
  if (store.size > 5000) {
    for (const [k, b] of store) if (b.resetAt <= now) store.delete(k)
  }

  const existing = store.get(ip)
  if (!existing || existing.resetAt <= now) {
    store.set(ip, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 }
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  existing.count += 1
  return { ok: true, remaining: limit - existing.count, retryAfterSeconds: 0 }
}

// One map per limiter name, kept on globalThis so Next's dev-mode module
// reloading doesn't silently reset every counter on each edit.
const GLOBAL_KEY = '__cf_rate_limit_stores__'

function getStore(name: string): Map<string, Bucket> {
  const g = globalThis as unknown as Record<string, Map<string, Map<string, Bucket>>>
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = new Map()
  const stores = g[GLOBAL_KEY]
  let store = stores.get(name)
  if (!store) { store = new Map(); stores.set(name, store) }
  return store
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
