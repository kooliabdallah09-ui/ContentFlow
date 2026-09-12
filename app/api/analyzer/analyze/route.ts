import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { transcribeAudioUrl } from '@/lib/scribe'
import { checkRateLimit, getClientIp, formatRetryAfter } from '@/lib/rate-limit'

export const maxDuration = 300

// Public top-of-funnel tool. Signed-out visitors get the format breakdown +
// video prompt; transcription and the recreate handoff need an account.
//
// Anonymous runs cost ~$0.015 each (6 downscaled frames through Sonnet vision,
// no transcription). ANALYZER_PUBLIC=0 kills the signed-out path instantly if
// cost ever runs away.
const ANON_FRAME_LIMIT = 6
const ANON_RATE_LIMIT = 2
const ANON_RATE_WINDOW_MS = 24 * 60 * 60 * 1000

function publicModeEnabled(): boolean {
  return process.env.ANALYZER_PUBLIC !== '0'
}

interface FrameInput {
  timeSeconds: number      // where in the video this frame lives
  base64: string           // raw base64 (no data: prefix)
  mimeType: string         // usually image/jpeg
}

interface AnalyzeInput {
  frames: FrameInput[]     // 8-15 evenly-spaced frames from the source
  audioUrl?: string        // public URL — Whisper transcribes if present
  sourceUrl?: string       // TikTok/IG/YT URL for provenance (optional)
  videoDurationSeconds: number
}

interface CaptionOverlay {
  text: string
  start: number
  end: number
  style: 'caption' | 'bold-white' | 'tiktok' | 'outline' | 'highlight' | 'bubble' | 'minimal'
  position: 'top' | 'center' | 'bottom'
}

interface FormatBreakdown {
  hook: string
  beats: string[]          // shot-by-shot structure
  pacing: 'slow' | 'medium' | 'fast'
  cuts: number             // estimated cut count
  musicMood: string
  character: string        // dense one-liner
  scene: string            // dense one-liner
  captionStyle: CaptionOverlay['style']
}

interface AnalyzeResult {
  breakdown: FormatBreakdown
  videoPrompt: string      // clean prompt for the video generator — NO caption text
  captions: CaptionOverlay[]
  captionsLocked: boolean  // true for anonymous runs — transcription needs an account
}

// Reel Analyzer — Phase 1: reads a set of sampled frames + optional audio,
// returns a structured breakdown, a clean video-gen prompt, and captions with
// timestamps ready to drop into the video editor.
export async function POST(request: NextRequest) {
  try {
    // Auth is optional — a valid token unlocks transcription and the full
    // frame budget; without one we fall back to rate-limited anonymous mode.
    const authHeader = request.headers.get('Authorization')
    let signedIn = false
    if (authHeader?.startsWith('Bearer ')) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
      signedIn = !!userData.user
    }

    if (!signedIn) {
      if (!publicModeEnabled()) {
        return NextResponse.json(
          { error: 'Sign in to analyze a reel.', code: 'auth_required' },
          { status: 401 },
        )
      }
      const limit = checkRateLimit(
        'analyzer', getClientIp(request), ANON_RATE_LIMIT, ANON_RATE_WINDOW_MS,
      )
      if (!limit.ok) {
        return NextResponse.json({
          error: `You've used your ${ANON_RATE_LIMIT} free teardowns for today. Create a free account for more, or come back in ${formatRetryAfter(limit.retryAfterSeconds)}.`,
          code: 'rate_limited',
        }, { status: 429 })
      }
    }

    const body = (await request.json()) as AnalyzeInput
    const maxFrames = signedIn ? 15 : ANON_FRAME_LIMIT
    const frames = Array.isArray(body.frames) ? body.frames.slice(0, maxFrames) : []
    if (frames.length < 3) {
      return NextResponse.json({ error: 'Need at least 3 sampled frames' }, { status: 400 })
    }
    const videoDurationSeconds = Number(body.videoDurationSeconds) || 15

    // ---------- Scribe transcription (signed-in only) ----------
    let captions: CaptionOverlay[] = []
    if (signedIn && body.audioUrl && body.audioUrl.startsWith('http')) {
      try {
        const { words } = await transcribeAudioUrl(body.audioUrl)
        // Group words into ~2-4 word phrases based on time gaps + word count.
        // Matches how TikTok / Reels caption tracks are usually chunked.
        const CHUNK_MAX_WORDS = 5
        const CHUNK_MAX_GAP = 0.3   // seconds
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let cur: any = null
        for (const w of words) {
          const t = w.word.trim()
          if (!t) continue
          if (!cur) {
            cur = { text: t, start: w.start, end: w.end }
            continue
          }
          const words_ = cur.text.split(/\s+/).length
          if (w.start - cur.end > CHUNK_MAX_GAP || words_ >= CHUNK_MAX_WORDS) {
            captions.push({ text: cur.text, start: cur.start, end: cur.end, style: 'caption', position: 'bottom' })
            cur = { text: t, start: w.start, end: w.end }
          } else {
            cur.text = `${cur.text} ${t}`
            cur.end = w.end
          }
        }
        if (cur) captions.push({ text: cur.text, start: cur.start, end: cur.end, style: 'caption', position: 'bottom' })
      } catch (err) {
        console.error('analyzer transcription failed (non-fatal):', err)
      }
    }

    // ---------- Vision analysis ----------
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Claude Vision content blocks: interleave images with time markers.
    const content: Anthropic.ContentBlockParam[] = []
    content.push({
      type: 'text',
      text: `You are analyzing a short vertical video (${videoDurationSeconds.toFixed(1)}s) sampled at ${frames.length} frames. Frames are provided in chronological order with their timestamps.

Return ONLY valid JSON, no preamble, no markdown fences.

{
  "breakdown": {
    "hook": "one sentence describing the first-second visual hook",
    "beats": ["3-6 short strings, each a shot/beat in order"],
    "pacing": "slow" | "medium" | "fast",
    "cuts": <estimated number of cuts>,
    "musicMood": "one phrase describing the audio vibe (upbeat, cinematic, lofi, hip-hop, ambient, etc)",
    "character": "dense one-liner — age, ethnicity, hair, one accessory, outfit (leave empty if no person is on-camera)",
    "scene": "dense one-liner — setting, lighting, mood",
    "captionStyle": "caption" | "bold-white" | "tiktok" | "outline" | "highlight" | "bubble" | "minimal"
  },
  "videoPrompt": "A single paragraph prompt for a text-to-video model (Seedance) that recreates this exact scene and character motion. IMPORTANT: describe visual + motion + camera + lighting only. DO NOT mention captions, text overlays, or on-screen text — those are added separately."
}

Rules for videoPrompt:
- 80-180 words.
- Motion-first: describe what MOVES.
- One paragraph, no bullets.
- No captions, no on-screen text, no watermarks.
- Match the pacing and camera work of the original.`,
    })

    for (const f of frames) {
      content.push({
        type: 'text',
        text: `Frame @ ${f.timeSeconds.toFixed(2)}s`,
      })
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: (f.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif') || 'image/jpeg',
          data: f.base64,
        },
      })
    }

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content }],
    })
    const rawText = (msg.content[0] as { type: 'text'; text: string }).text.trim()
    const cleaned = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any
    try { parsed = JSON.parse(cleaned) } catch {
      return NextResponse.json(
        { error: 'Analysis parse failed', raw: cleaned.slice(0, 600) },
        { status: 500 },
      )
    }

    const breakdown: FormatBreakdown = {
      hook: String(parsed?.breakdown?.hook ?? '').slice(0, 300),
      beats: Array.isArray(parsed?.breakdown?.beats) ? parsed.breakdown.beats.map(String).slice(0, 8) : [],
      pacing: (['slow', 'medium', 'fast'].includes(parsed?.breakdown?.pacing) ? parsed.breakdown.pacing : 'medium'),
      cuts: Number(parsed?.breakdown?.cuts) || 0,
      musicMood: String(parsed?.breakdown?.musicMood ?? '').slice(0, 100),
      character: String(parsed?.breakdown?.character ?? '').slice(0, 300),
      scene: String(parsed?.breakdown?.scene ?? '').slice(0, 300),
      captionStyle: (parsed?.breakdown?.captionStyle as CaptionOverlay['style']) || 'caption',
    }

    // Apply the detected caption style back to every caption chunk.
    captions = captions.map(c => ({ ...c, style: breakdown.captionStyle }))

    const videoPrompt = String(parsed?.videoPrompt ?? '').slice(0, 3000)

    const result: AnalyzeResult = { breakdown, videoPrompt, captions, captionsLocked: !signedIn }
    return NextResponse.json(result)
  } catch (err) {
    console.error('analyzer/analyze error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 },
    )
  }
}
