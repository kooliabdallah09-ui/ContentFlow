// Shotstack stitch provider — drop-in replacement for lib/creatomate.ts.
// Set SHOTSTACK_ENV=production to use the paid endpoint. Default is 'stage', which
// is Shotstack's free sandbox (20 min/month, no card required, watermark-free).

const SHOTSTACK_BASE = process.env.SHOTSTACK_ENV === 'production'
  ? 'https://api.shotstack.io/edge'
  : 'https://api.shotstack.io/stage'

export async function submitStitchJob({
  talkingHeadUrl,
  talkingHeadDuration,
  broll1Url,
  broll2Url,
  audioOverlayUrl,
  spokenScript,
  syncedCaptions,
  watermark,
}: {
  talkingHeadUrl: string
  talkingHeadDuration?: number  // seconds; used to position B-roll2 and chunk captions
  broll1Url?: string
  broll2Url?: string
  audioOverlayUrl?: string      // Hero tier: ElevenLabs/OpenAI voice — mutes talking-head audio
  spokenScript?: string         // Fallback caption source if Whisper sync unavailable
  syncedCaptions?: Array<{ text: string; start: number; end: number }>  // Whisper word-timed chunks
  watermark?: boolean           // Free-tier flag — overlays "Made with ContentFlow" bottom-right
}): Promise<{ renderId: string }> {
  const apiKey = process.env.SHOTSTACK_API_KEY
  if (!apiKey) throw new Error('SHOTSTACK_API_KEY not configured')

  //   0–4s: B-roll1 (muted, fades out)
  //   3.7s: talking head starts (0.3s crossover)
  //   talkingHeadEnd: B-roll2 appended (muted, fades in)
  const talkingHeadStart = broll1Url ? 3.7 : 0
  const talkingHeadLength = talkingHeadDuration && talkingHeadDuration > 0 ? talkingHeadDuration : 12
  const talkingHeadEnd = talkingHeadStart + talkingHeadLength

  // === Track 1 (bottom): visuals ===
  const visualClips: Record<string, unknown>[] = []

  if (broll1Url) {
    visualClips.push({
      asset: { type: 'video', src: broll1Url, volume: 0 },
      start: 0,
      length: 4,
      fit: 'cover',
      transition: { out: 'fade' },
    })
  }

  visualClips.push({
    asset: {
      type: 'video',
      src: talkingHeadUrl,
      volume: audioOverlayUrl ? 0 : 1,
    },
    start: talkingHeadStart,
    length: talkingHeadLength,
    fit: 'cover',
  })

  if (broll2Url) {
    visualClips.push({
      asset: { type: 'video', src: broll2Url, volume: 0 },
      start: talkingHeadEnd,
      length: 4,
      fit: 'cover',
      transition: { in: 'fade' },
    })
  }

  const tracks: Record<string, unknown>[] = [{ clips: visualClips }]

  // === Track 2: audio overlay (Hero) ===
  // Bound to talking-head length so it doesn't bleed over B-roll2.
  if (audioOverlayUrl) {
    tracks.push({
      clips: [{
        asset: { type: 'audio', src: audioOverlayUrl, volume: 1 },
        start: talkingHeadStart,
        length: talkingHeadLength,
      }],
    })
  }

  // === Track 3 (top): TikTok-style word-by-word captions ===
  // Build captions from the spoken script directly — no transcription needed because we
  // already have the exact words. Split into ~3-word chunks, distribute evenly across
  // the talking-head duration. Each chunk is its own text clip stacked into a single track.
  // Sync isn't frame-perfect since speech pace varies, but for 8–12s clips it's tight enough.
  // Whisper-synced captions take priority. Each chunk has real start/end times
  // from word-level transcription — true TikTok-style sync, not time-divided guesses.
  if (syncedCaptions && syncedCaptions.length) {
    const clips = syncedCaptions.map(chunk => makeCaptionClip(chunk.text, chunk.start, Math.max(0.3, chunk.end - chunk.start)))
    tracks.unshift({ clips })
  } else if (spokenScript && spokenScript.trim()) {
    // Fallback: even-time-division chunks from the raw script. Less accurate but
    // doesn't require Whisper. Used if OPENAI_API_KEY is missing or transcription fails.
    const captionClips = buildCaptionClips(spokenScript.trim(), talkingHeadStart, talkingHeadLength)
    if (captionClips.length) {
      tracks.unshift({ clips: captionClips })
    }
  }

  // === Watermark for free-tier output ===
  // Shotstack 'title' asset style presets (subtitle, minimal, etc.) center-anchor
  // their text regardless of the clip's `position` field. We need a true corner
  // placement, so we use an HTML asset that we style ourselves with text-align
  // and box geometry — gives us pixel control without fighting the presets.
  if (watermark) {
    const totalLength = (broll2Url ? talkingHeadEnd + 4 : talkingHeadEnd)
    tracks.unshift({
      clips: [{
        asset: {
          type: 'html',
          html: '<p>Made with ContentFlow</p>',
          css: 'p { font-family: "Inter", sans-serif; font-size: 26px; font-weight: 700; color: #FFFFFF; text-shadow: 0 1px 3px rgba(0,0,0,0.7); margin: 0; padding: 6px 12px; background: rgba(0,0,0,0.45); border-radius: 6px; display: inline-block; white-space: nowrap; }',
          width: 380,
          height: 60,
          background: 'transparent',
        },
        start: 0,
        length: totalLength,
        position: 'bottomRight',
        offset: { x: -0.02, y: 0.02 },
      }],
    })
  }

  const body = {
    timeline: {
      background: '#000000',
      tracks,
    },
    output: {
      format: 'mp4',
      size: { width: 1080, height: 1920 },
      fps: 30,
    },
  }

  const res = await fetch(`${SHOTSTACK_BASE}/render`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const rawText = await res.text().catch(() => '')
    let parsed: {
      message?: string
      response?: { message?: string; error?: unknown; errors?: unknown }
      error?: unknown
      errors?: unknown
    } = {}
    try { parsed = JSON.parse(rawText) } catch {}

    // Shotstack returns validation errors in different shapes depending on which endpoint
    // and version. Try every known path so we don't blackbox the developer.
    const errorsArray =
      parsed.response?.errors
      || parsed.errors
      || parsed.response?.error
      || parsed.error
    const errorsDetail = errorsArray ? JSON.stringify(errorsArray) : ''
    const msg = parsed.response?.message || parsed.message || ''
    const detail = [msg, errorsDetail].filter(Boolean).join(' — ') || rawText.slice(0, 500) || res.statusText

    console.error('[shotstack] render rejected', { status: res.status, detail, payload: body })
    throw new Error(`Shotstack ${res.status}: ${detail}`)
  }

  const data = await res.json()
  const renderId = data?.response?.id ?? data?.id
  if (!renderId) throw new Error(`Shotstack did not return a render ID. Response: ${JSON.stringify(data)}`)

  return { renderId }
}

// Single caption clip with TikTok-style centering. Shared between Whisper-synced
// chunks and the script-fallback chunker so both paths render identically.
function makeCaptionClip(text: string, start: number, length: number): Record<string, unknown> {
  return {
    asset: {
      type: 'title',
      text,
      style: 'subtitle',
      color: '#FFFFFF',
      background: 'rgba(0,0,0,0.55)',
      size: 'small',
    },
    start,
    length,
    position: 'bottom',
    offset: { y: 0.12 },
    transition: { in: 'fade', out: 'fade' },
  }
}

// Fallback: split the spoken script into 5-word chunks and time them evenly.
// Used only when Whisper transcription is unavailable.
function buildCaptionClips(script: string, startAt: number, totalLength: number): Record<string, unknown>[] {
  const cleaned = script
    .replace(/\[[^\]]*\]/g, '')          // [BACKGROUND:], [HOOK ...] etc
    .replace(/\([^)]*\)/g, '')           // (energetic, slightly amazed)
    .replace(/["“”]/g, '')               // surrounding quotes
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return []
  const words = cleaned.split(' ').filter(Boolean)
  if (!words.length) return []

  const WORDS_PER_CHUNK = 5
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += WORDS_PER_CHUNK) {
    chunks.push(words.slice(i, i + WORDS_PER_CHUNK).join(' '))
  }

  const perChunk = totalLength / chunks.length
  return chunks.map((text, i) => makeCaptionClip(text, startAt + i * perChunk, perChunk))
}

// Status normalised to match the Creatomate interface used by the route + UI.
//   Shotstack:    queued | fetching | rendering | saving | done | failed
//   Creatomate:   planned | waiting | transcribing | rendering | succeeded | failed
export async function getStitchStatus(renderId: string): Promise<{
  status: 'planned' | 'waiting' | 'transcribing' | 'rendering' | 'succeeded' | 'failed'
  url?: string
  error?: string
}> {
  const apiKey = process.env.SHOTSTACK_API_KEY
  if (!apiKey) throw new Error('SHOTSTACK_API_KEY not configured')

  const res = await fetch(`${SHOTSTACK_BASE}/render/${renderId}`, {
    headers: { 'x-api-key': apiKey },
  })

  if (!res.ok) throw new Error(`Failed to get Shotstack render status: ${res.statusText}`)

  const data = await res.json()
  const r = data?.response ?? data
  const rawStatus: string = r?.status ?? 'queued'
  const url: string | undefined = r?.url ?? undefined
  const error: string | undefined = r?.error ?? undefined

  const mapped: 'planned' | 'waiting' | 'transcribing' | 'rendering' | 'succeeded' | 'failed' =
    rawStatus === 'done' ? 'succeeded'
    : rawStatus === 'failed' ? 'failed'
    : rawStatus === 'rendering' || rawStatus === 'saving' ? 'rendering'
    : rawStatus === 'fetching' ? 'waiting'
    : 'planned'

  return { status: mapped, url, error }
}
