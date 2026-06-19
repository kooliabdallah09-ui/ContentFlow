import * as shotstack from '@/lib/shotstack'
import { transcribeWithTimestamps, buildSyncedCaptionChunks } from '@/lib/whisper'
import { PLAN_CONFIG, type PlanTier } from '@/lib/planConfig'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Stitch only handles captions + watermark + (for chained 20s) concatenation
// of multiple Kling clips. Kling v3 omni-video generates the talking head WITH
// native audio so there's no lipsync pass, no voice track, no B-roll overlay.
export const maxDuration = 120

async function submitStitchJob(input: Parameters<typeof shotstack.submitStitchJob>[0]) {
  return shotstack.submitStitchJob(input)
}

async function getStitchStatus(renderId: string) {
  return shotstack.getStitchStatus(renderId)
}

async function getPlanWatermark(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return true

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) return true

  try {
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
    if (!userData?.user) return true
    const { data: credits } = await supabase
      .from('user_credits')
      .select('plan')
      .eq('user_id', userData.user.id)
      .single()
    const plan = (credits?.plan ?? 'free') as PlanTier
    return PLAN_CONFIG[plan]?.watermark ?? true
  } catch {
    return true
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      talkingHeadUrl,
      talkingHeadDuration,
      additionalTalkingHeadUrls,
      spokenScript,
      language,
      aspect,
    } = await request.json()

    if (!talkingHeadUrl) {
      return NextResponse.json({ error: 'Missing talkingHeadUrl' }, { status: 400 })
    }

    const watermark = await getPlanWatermark(request)

    // Whisper transcription for word-timed captions. Cheap (~$0.0001/video).
    let syncedCaptions: Array<{ text: string; start: number; end: number }> | undefined
    if (process.env.OPENAI_API_KEY) {
      try {
        const langCode = typeof language === 'string' && language.length >= 2 ? language.slice(0, 2) : undefined
        const { words } = await transcribeWithTimestamps(talkingHeadUrl, langCode)
        syncedCaptions = buildSyncedCaptionChunks(words, { maxWords: 4, offsetSeconds: 0 })
      } catch (err) {
        console.warn('[stitch] Whisper transcription failed, falling back to script-based captions:', err instanceof Error ? err.message : err)
      }
    }

    const { renderId } = await submitStitchJob({
      talkingHeadUrl,
      talkingHeadDuration: typeof talkingHeadDuration === 'number' ? talkingHeadDuration : undefined,
      additionalTalkingHeadUrls: Array.isArray(additionalTalkingHeadUrls) ? additionalTalkingHeadUrls : undefined,
      spokenScript: typeof spokenScript === 'string' ? spokenScript : undefined,
      syncedCaptions,
      watermark,
      aspect: typeof aspect === 'string' ? aspect as 'portrait' | 'square' | 'landscape' : undefined,
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
