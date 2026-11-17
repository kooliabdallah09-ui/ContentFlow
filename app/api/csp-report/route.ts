// Receives Content-Security-Policy violation reports from browsers (the policy
// is in lib/csp.ts, sent report-only from next.config.ts) and writes one log
// line per violation. Read them in Vercel logs by searching "[csp]".
//
// Public and unauthenticated by nature (browsers post here on their own), so
// it does nothing but log: no database, no external calls. A small per-instance
// cap keeps a noisy page or a script from flooding the logs.

import { NextRequest } from 'next/server'
import { parseCspReports } from '@/lib/csp'
import { getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 16 * 1024
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 20

// Best-effort only: each serverless instance has its own map. That is fine
// here, the worst case is some extra log lines.
const seen = new Map<string, { count: number; resetAt: number }>()

function allow(ip: string): boolean {
  const now = Date.now()
  if (seen.size > 5000) seen.clear()
  const entry = seen.get(ip)
  if (!entry || entry.resetAt <= now) {
    seen.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  entry.count += 1
  return entry.count <= MAX_PER_WINDOW
}

const noContent = () => new Response(null, { status: 204 })

export async function POST(request: NextRequest) {
  try {
    if (!allow(getClientIp(request))) return noContent()

    const raw = await request.text()
    if (!raw || raw.length > MAX_BODY_BYTES) return noContent()

    for (const v of parseCspReports(JSON.parse(raw))) {
      // Browser extensions inject their own scripts and trip every policy.
      if (/^(chrome|moz|safari|safari-web)-extension/.test(v.blocked) || /^(chrome|moz|safari|safari-web)-extension/.test(v.source)) continue
      console.warn(`[csp] ${v.directive} blocked=${v.blocked || '-'} page=${v.page || '-'} source=${v.source || '-'}`)
    }
  } catch {
    // Malformed report: nothing to do.
  }
  return noContent()
}
