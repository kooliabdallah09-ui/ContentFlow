// POST { brief } → { storyboard }
// The storyboard the user approves before the code is written. Free, but
// only for users who can afford the ad, and rate-limited: it's a real
// model call (~$0.05).

import { NextRequest, NextResponse } from 'next/server'
import { planMotionAd } from '@/lib/motion/generate'
import { MOTION_AD_CREDITS, authUser, creditBalance, parseBrief } from '@/lib/motion/server'
import { checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const userId = await authUser(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const brief = parseBrief(body?.brief)
  if (typeof brief === 'string') return NextResponse.json({ error: brief }, { status: 400 })

  const credits = await creditBalance(userId)
  if (!credits || credits.balance < MOTION_AD_CREDITS) {
    return NextResponse.json({ error: `A motion ad costs ${MOTION_AD_CREDITS} credits` }, { status: 402 })
  }
  const limit = await checkRateLimit('motion-plan', userId, 20, 24 * 3600 * 1000)
  if (!limit.ok) return NextResponse.json({ error: 'Storyboard limit reached for today' }, { status: 429 })

  try {
    const r = await planMotionAd(brief)
    console.info('[motion/plan]', { userId, costUsd: r.costUsd.toFixed(4), ms: r.ms })
    return NextResponse.json({ storyboard: r.storyboard })
  } catch (err) {
    console.error('[motion/plan]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not plan the ad' }, { status: 500 })
  }
}
