import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { submitBrollCutaway } from '@/lib/shotstack'
import { pickCutawayTime, pickCutawayDuration, beatBoundariesFromScript, canCutaway, MIN_CUTAWAY_VIDEO_SECONDS } from '@/lib/broll'

export const maxDuration = 60

// Cut a product B-roll clip into a finished UGC video.
//
// The cutaway is overlaid, not spliced: the creator's audio keeps running
// underneath so the voiceover never breaks mid-word and the ad's length
// doesn't change. Placement lands on a sentence boundary when a script is
// available (see lib/broll).
//
// No credits — the Ken Burns source clip and this stitch are both
// Shotstack-only, with no model call in the path.

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const mainUrl = typeof body.mainUrl === 'string' ? body.mainUrl : ''
    const brollUrl = typeof body.brollUrl === 'string' ? body.brollUrl : ''
    const mainDuration = Number(body.mainDuration)
    const aspect = body.aspect === 'square' || body.aspect === 'landscape' ? body.aspect : 'portrait'

    if (!mainUrl || !brollUrl) {
      return NextResponse.json({ error: 'mainUrl and brollUrl are required' }, { status: 400 })
    }
    if (!Number.isFinite(mainDuration) || mainDuration <= 0) {
      return NextResponse.json({ error: 'mainDuration must be a positive number' }, { status: 400 })
    }
    if (!canCutaway(mainDuration)) {
      return NextResponse.json({
        error: `This ad is too short for a cutaway (needs ${MIN_CUTAWAY_VIDEO_SECONDS}s+).`,
        code: 'too_short',
      }, { status: 422 })
    }

    const cutawayDuration = pickCutawayDuration(mainDuration)
    const atSeconds = Number.isFinite(Number(body.atSeconds))
      ? Number(body.atSeconds)
      : pickCutawayTime(mainDuration, {
          beatBoundaries: beatBoundariesFromScript(typeof body.script === 'string' ? body.script : null),
          cutawayDuration,
        })

    const { renderId } = await submitBrollCutaway({
      mainUrl,
      mainDuration,
      brollUrl,
      atSeconds,
      cutawayDuration,
      aspect,
    })

    return NextResponse.json({ renderId, atSeconds, cutawayDuration })
  } catch (err) {
    console.error('broll/cutaway error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Cutaway failed' },
      { status: 500 },
    )
  }
}
