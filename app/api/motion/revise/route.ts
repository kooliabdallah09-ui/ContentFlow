// POST { jobToken, brief, code, error?, stills? } → { code | null }
// The self-review (stills) and error fixes for a paid ad. No charge: the
// write covered them. The job token proves the ad was paid for, and the
// shared rate limiter caps fixes per job.

import { NextRequest, NextResponse } from 'next/server'
import { reviseMotionAd } from '@/lib/motion/generate'
import { MOTION_FIXES_PER_AD, authUser, parseBrief, verifyJobToken } from '@/lib/motion/server'
import { checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const userId = await authUser(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const jobId = verifyJobToken(body?.jobToken, userId)
  if (!jobId) return NextResponse.json({ error: 'This ad has expired; make a new one' }, { status: 403 })

  const brief = parseBrief(body?.brief)
  if (typeof brief === 'string') return NextResponse.json({ error: brief }, { status: 400 })
  const code = typeof body?.code === 'string' ? body.code.slice(0, 80_000) : ''
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  const error = typeof body?.error === 'string' ? body.error.slice(0, 4000) : undefined
  const stills = Array.isArray(body?.stills)
    ? (body.stills as Array<{ frame?: unknown; jpegBase64?: unknown }>)
        .slice(0, 10)
        .filter(s => typeof s?.jpegBase64 === 'string' && (s.jpegBase64 as string).length < 600_000)
        .map(s => ({ frame: Number(s.frame) || 0, jpegBase64: s.jpegBase64 as string }))
    : undefined
  if (!error && !stills?.length) return NextResponse.json({ error: 'Nothing to fix' }, { status: 400 })

  const limit = await checkRateLimit('motion-fix', jobId, MOTION_FIXES_PER_AD, 24 * 3600 * 1000)
  if (!limit.ok) return NextResponse.json({ error: 'No more fixes left for this ad' }, { status: 429 })

  try {
    const r = await reviseMotionAd({ brief, code, error, stills })
    console.info('[motion/revise]', { userId, jobId, kind: error ? 'error' : 'review', changed: r.code !== null, costUsd: r.costUsd.toFixed(4), ms: r.ms })
    return NextResponse.json({ code: r.code })
  } catch (err) {
    console.error('[motion/revise]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not fix the ad' }, { status: 500 })
  }
}
