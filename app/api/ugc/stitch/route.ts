import { submitStitchJob, getStitchStatus } from '@/lib/shotstack'
import { getMusicTrack, type MusicMood } from '@/lib/music-library'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Stitch concatenates Kling clips and applies aspect ratio.
// Watermark is added for free-plan users; paid plans get clean output.
export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const {
      talkingHeadUrl,
      talkingHeadDuration,
      additionalTalkingHeadUrls,
      aspect,
      musicMood,
      audioOverlayUrl,
    } = await request.json()

    if (!talkingHeadUrl) {
      return NextResponse.json({ error: 'Missing talkingHeadUrl' }, { status: 400 })
    }

    // Resolve the caller's plan to decide watermark on/off.
    // Fail-open to "no watermark" if auth is missing (unlikely — this route
    // is called from authenticated client code).
    let isFreePlan = false
    const authHeader = request.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
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
    }

    const track = getMusicTrack(musicMood as MusicMood | null)

    const { renderId } = await submitStitchJob({
      talkingHeadUrl,
      talkingHeadDuration: typeof talkingHeadDuration === 'number' ? talkingHeadDuration : undefined,
      additionalTalkingHeadUrls: Array.isArray(additionalTalkingHeadUrls) ? additionalTalkingHeadUrls : undefined,
      watermark: isFreePlan,
      aspect: typeof aspect === 'string' ? aspect as 'portrait' | 'square' | 'landscape' : undefined,
      music: track ? { url: track.url, volume: track.volume } : undefined,
      audioOverlayUrl: typeof audioOverlayUrl === 'string' && audioOverlayUrl.startsWith('http') ? audioOverlayUrl : undefined,
    })
    return NextResponse.json({ renderId })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Stitch submission failed' },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  const renderId = request.nextUrl.searchParams.get('renderId')
  if (!renderId) {
    return NextResponse.json({ error: 'Missing renderId' }, { status: 400 })
  }

  try {
    const result = await getStitchStatus(renderId)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status check failed' },
      { status: 500 },
    )
  }
}
