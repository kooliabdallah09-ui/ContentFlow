// Crush-Test multi-shot finalize.
//
// Once the client has confirmed every Seedance shot job is done via
// /api/ugc/video-status polling, it hands us the ordered videoUrls +
// per-shot durations here. We submit a Shotstack concat via
// submitStitchJob (talkingHeadUrl = shot 1, additionalTalkingHeadUrls =
// shots 2..N, on the same track with audio on) — that helper already
// concatenates chained clips end-to-end which is exactly what we need
// for the crush-test montage. Poll the returned renderId via the
// existing GET /api/ugc/stitch?renderId=... to fetch the final mp4.
import { NextRequest, NextResponse } from 'next/server'
import { submitStitchJob } from '@/lib/shotstack'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

interface Body {
  shots: Array<{ videoUrl: string; durationSec: number }>
  aspect?: 'portrait' | 'square' | 'landscape'
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as Body
    const shots = Array.isArray(body.shots) ? body.shots : []
    const usable = shots.filter(s => typeof s.videoUrl === 'string' && s.videoUrl.startsWith('http'))
    if (usable.length === 0) {
      return NextResponse.json({ error: 'No shots to stitch' }, { status: 400 })
    }
    if (usable.length === 1) {
      // Nothing to concat — return the single url as-is so the client
      // can short-circuit into the "completed" path.
      return NextResponse.json({ singleShot: true, finalVideoUrl: usable[0].videoUrl })
    }

    // submitStitchJob concatenates clips on the same track using a
    // uniform per-clip length (talkingHeadDuration). Our per-shot
    // durations can vary (5–8s typically) so we pass the MAX to give
    // every clip enough runway; Shotstack cuts at the natural end of
    // each mp4 anyway. Audio is on (volume:1 for the "talking head"
    // track — here it carries the native Seedance crunch audio).
    const perClipLength = Math.max(...usable.map(s => Math.max(3, Math.round(s.durationSec || 5))))
    const aspect: 'portrait' | 'square' | 'landscape' = body.aspect === 'landscape' || body.aspect === 'square'
      ? body.aspect
      : 'portrait'

    // Free-plan users get the watermark; paid plans stay clean.
    let isFreePlan = false
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
    if (userData.user) {
      const { data: credits } = await supabase
        .from('user_credits').select('plan').eq('user_id', userData.user.id).maybeSingle()
      isFreePlan = !credits?.plan || credits.plan === 'free'
    }

    const { renderId } = await submitStitchJob({
      talkingHeadUrl: usable[0].videoUrl,
      talkingHeadDuration: perClipLength,
      additionalTalkingHeadUrls: usable.slice(1).map(s => s.videoUrl),
      watermark: isFreePlan,
      aspect,
    })

    return NextResponse.json({ renderId })
  } catch (err) {
    console.error('ugc/motion-broll-multishot/finalize error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Finalize failed' },
      { status: 500 },
    )
  }
}
