// POST { brief } → { code, jobToken, creditDeducted, newBalance }
// Writes the ad's code and charges for the whole ad (write + self-review +
// fixes). Charged only after the code comes back; the job token lets the
// page call /api/motion/revise for the review and any fixes.

import { NextRequest, NextResponse } from 'next/server'
import { writeMotionAd } from '@/lib/motion/generate'
import { MOTION_AD_CREDITS, adminClient, authUser, creditBalance, issueJobToken, parseBrief } from '@/lib/motion/server'
import { deductCredits } from '@/lib/deduct-credits'
import { checkRateLimit, releaseRateLimit } from '@/lib/rate-limit'

export const maxDuration = 300

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
  // Reserved up front so a burst of requests can't all pass; handed back if
  // the write fails, so a model error doesn't eat the user's hourly quota.
  const limit = await checkRateLimit('motion-write', userId, 10, 3600 * 1000)
  if (!limit.ok) return NextResponse.json({ error: 'Too many motion ads this hour' }, { status: 429 })

  try {
    const r = await writeMotionAd(brief)
    if (!r.code) throw new Error('The model returned no code')

    // Re-read right before charging: the write takes a couple of minutes.
    const now = await creditBalance(userId)
    if (!now || now.balance < MOTION_AD_CREDITS) {
      return NextResponse.json({ error: `A motion ad costs ${MOTION_AD_CREDITS} credits` }, { status: 402 })
    }
    const supabase = adminClient()
    const { newBalance } = await deductCredits(supabase, userId, MOTION_AD_CREDITS, now.balance, now.pack_credits)
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: MOTION_AD_CREDITS,
      transaction_type: 'generation',
      content_type: 'video',
      description: `Motion ad: ${brief.brandName}`,
    })

    const { jobId, token } = issueJobToken(userId)
    console.info('[motion/write]', { userId, jobId, costUsd: r.costUsd.toFixed(4), ms: r.ms })
    return NextResponse.json({ code: r.code, jobToken: token, creditDeducted: MOTION_AD_CREDITS, newBalance })
  } catch (err) {
    await releaseRateLimit('motion-write', userId)
    console.error('[motion/write]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not write the ad' }, { status: 500 })
  }
}
