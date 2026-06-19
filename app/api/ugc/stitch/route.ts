import * as creatomate from '@/lib/creatomate'
import * as shotstack from '@/lib/shotstack'
import { transcribeWithTimestamps, buildSyncedCaptionChunks } from '@/lib/whisper'
import { runLipsync } from '@/lib/replicate'
import { PLAN_CONFIG, type PlanTier } from '@/lib/planConfig'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Lipsync (sync/lipsync-2 on Replicate) can take 60-150s on 12s clips.
// Total stitch route can stretch to ~3min, so allow the full Vercel max.
export const maxDuration = 300

// Dispatch: Shotstack is preferred when its key is present (cheaper + free tier).
// Falls back to Creatomate. Render IDs are prefixed so polling routes to the right
// provider regardless of which one created the render.
const SHOTSTACK_PREFIX = 'shotstack:'

function provider() {
  return process.env.SHOTSTACK_API_KEY ? 'shotstack' : 'creatomate'
}

async function submitStitchJob(input: Parameters<typeof creatomate.submitStitchJob>[0]) {
  if (provider() === 'shotstack') {
    const { renderId } = await shotstack.submitStitchJob(input)
    return { renderId: `${SHOTSTACK_PREFIX}${renderId}` }
  }
  return creatomate.submitStitchJob(input)
}

async function getStitchStatus(renderId: string) {
  if (renderId.startsWith(SHOTSTACK_PREFIX)) {
    return shotstack.getStitchStatus(renderId.slice(SHOTSTACK_PREFIX.length))
  }
  return creatomate.getStitchStatus(renderId)
}

// Look up the user's plan from Supabase so the watermark decision is server-trust.
// Returns 'free' as a safe default if anything goes wrong — better to watermark
// a paid user (annoying but recoverable) than to leak unwatermarked videos.
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
    const { talkingHeadUrl, talkingHeadDuration, broll1Url, broll2Url, audioOverlayUrl, spokenScript, language, aspect } = await request.json()
    if (!talkingHeadUrl) {
      return NextResponse.json({ error: 'Missing talkingHeadUrl' }, { status: 400 })
    }

    const watermark = await getPlanWatermark(request)

    // Hero tier lipsync — remap Sora's mouth to the ElevenLabs voice so the
    // branded voiceover actually matches the character's lips. If lipsync fails,
    // fall back to the original Sora video (user gets the unsynced version
    // rather than a hard failure).
    let finalTalkingHeadUrl: string = talkingHeadUrl
    if (audioOverlayUrl && process.env.REPLICATE_API_TOKEN) {
      try {
        finalTalkingHeadUrl = await runLipsync(talkingHeadUrl, audioOverlayUrl)
      } catch (err) {
        console.warn('[stitch] Lipsync failed, using unsynced Sora video:', err instanceof Error ? err.message : err)
      }
    }

    // Transcribe with Whisper for true word-level caption sync. Cheap (~$0.0001/video).
    // Audio source priority:
    //   1. ElevenLabs/OpenAI TTS overlay (Hero tier) — that's the audio that'll play.
    //   2. Otherwise the talking-head video — Whisper accepts mp4 directly.
    // Falls back to the existing client-script chunking if Whisper throws.
    let syncedCaptions: Array<{ text: string; start: number; end: number }> | undefined
    if (process.env.OPENAI_API_KEY) {
      try {
        const transcribeUrl = audioOverlayUrl ?? talkingHeadUrl
        const langCode = typeof language === 'string' && language.length >= 2 ? language.slice(0, 2) : undefined
        const { words } = await transcribeWithTimestamps(transcribeUrl, langCode)
        // Talking head now starts at 0 (cutaway layout — B-rolls overlay mid-video,
        // they don't push the talking head back), so caption offset is always 0.
        syncedCaptions = buildSyncedCaptionChunks(words, { maxWords: 4, offsetSeconds: 0 })
      } catch (err) {
        console.warn('[stitch] Whisper transcription failed, falling back to script-based captions:', err instanceof Error ? err.message : err)
      }
    }

    const { renderId } = await submitStitchJob({
      talkingHeadUrl: finalTalkingHeadUrl,
      talkingHeadDuration: typeof talkingHeadDuration === 'number' ? talkingHeadDuration : undefined,
      broll1Url,
      broll2Url,
      audioOverlayUrl,
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
