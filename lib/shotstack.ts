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
  aspect,
}: {
  talkingHeadUrl: string
  talkingHeadDuration?: number  // seconds; used to position B-roll2 and chunk captions
  broll1Url?: string
  broll2Url?: string
  audioOverlayUrl?: string      // Hero tier: ElevenLabs/OpenAI voice — mutes talking-head audio
  spokenScript?: string         // Fallback caption source if Whisper sync unavailable
  syncedCaptions?: Array<{ text: string; start: number; end: number }>  // Whisper word-timed chunks
  watermark?: boolean           // Free-tier flag — overlays "Made with ContentFlow" bottom-right
  aspect?: 'portrait' | 'square' | 'landscape'  // Drives the render output size
}): Promise<{ renderId: string }> {
  const apiKey = process.env.SHOTSTACK_API_KEY
  if (!apiKey) throw new Error('SHOTSTACK_API_KEY not configured')

  // === Layout: B-roll CUTAWAY pattern ===
  // Talking head plays continuously on the bottom track with full audio. B-rolls
  // overlay on a higher track at chosen moments — visuals cut away briefly, audio
  // never stops. This is the classic UGC pattern: "she keeps talking, you see the
  // product spray/use/result over her voice".
  //
  // Track stack (low → high):
  //   1. talking head (full duration, audio plays)
  //   2. B-roll cutaways (muted, overlay specific seconds)
  //   3. audio overlay if Hero tier
  //   4. captions
  //   5. watermark (if free)
  const talkingHeadStart = 0
  const talkingHeadLength = talkingHeadDuration && talkingHeadDuration > 0 ? talkingHeadDuration : 12
  const talkingHeadEnd = talkingHeadStart + talkingHeadLength

  // Pick when each B-roll cuts in. Avoid the first second (let the hook land) and
  // the last second (let the CTA land on the character's face).
  // 1 B-roll: 35% through, ~2.5s long
  // 2 B-rolls: 25% and 65% through, ~2.0s each
  // Lengths clamp so a 4s video could technically take a B-roll, though current
  // policy is 0 B-rolls at 4s.
  const brollCount = (broll1Url ? 1 : 0) + (broll2Url ? 1 : 0)
  const brollSlots: Array<{ url: string; start: number; length: number }> = []
  if (brollCount === 1 && broll1Url) {
    const length = Math.min(2.5, Math.max(1.5, talkingHeadLength * 0.35))
    const start = talkingHeadLength * 0.35
    brollSlots.push({ url: broll1Url, start, length })
  } else if (brollCount === 2 && broll1Url && broll2Url) {
    const length = Math.min(2.0, Math.max(1.2, talkingHeadLength * 0.18))
    brollSlots.push({ url: broll1Url, start: talkingHeadLength * 0.25, length })
    brollSlots.push({ url: broll2Url, start: talkingHeadLength * 0.65, length })
  }

  // === Track 1 (bottom): talking head — plays uninterrupted with audio ===
  const talkingHeadClip = {
    asset: {
      type: 'video',
      src: talkingHeadUrl,
      volume: audioOverlayUrl ? 0 : 1,
    },
    start: talkingHeadStart,
    length: talkingHeadLength,
    fit: 'cover',
  }

  const tracks: Record<string, unknown>[] = [{ clips: [talkingHeadClip] }]

  // === Track 2: B-roll cutaways (visual-only overlay) ===
  // Muted so the talking-head audio (or overlay) carries through unchanged.
  if (brollSlots.length) {
    tracks.unshift({
      clips: brollSlots.map(slot => ({
        asset: { type: 'video', src: slot.url, volume: 0 },
        start: slot.start,
        length: slot.length,
        fit: 'cover',
        transition: { in: 'fade', out: 'fade' },
      })),
    })
  }

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
    // With the new cutaway layout, total length = talkingHeadEnd. B-rolls overlay
    // INSIDE the talking head, so they don't extend the timeline.
    const totalLength = talkingHeadEnd
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

  // Render output size — matches the upstream Nano Banana / Sora frame aspect.
  const outputSize =
    aspect === 'square'    ? { width: 1080, height: 1080 } :
    aspect === 'landscape' ? { width: 1920, height: 1080 } :
                             { width: 1080, height: 1920 }

  const body = {
    timeline: {
      background: '#000000',
      tracks,
    },
    output: {
      format: 'mp4',
      size: outputSize,
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
  // Custom HTML title so we control wrap-width, font size and bottom-safe
  // padding precisely. Shotstack's 'subtitle' preset rendered too large and
  // sometimes overflowed the 9:16 frame on longer chunks. We cap text-block
  // width at 70vw and use a smaller font, plus a 5vh bottom offset so captions
  // sit clearly above the bottom edge but never spill outside it.
  const safeText = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return {
    asset: {
      type: 'html',
      html: `<p>${safeText}</p>`,
      css: 'p{font-family:"Inter",sans-serif;font-size:3.4vh;font-weight:700;line-height:1.2;color:#fff;text-align:center;margin:0;padding:8px 14px;background:rgba(0,0,0,0.55);border-radius:8px;display:inline-block;max-width:88%;white-space:normal;word-break:break-word;}',
      width: 900,
      height: 240,
      background: 'transparent',
    },
    start,
    length,
    position: 'bottom',
    offset: { y: 0.06 },
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
