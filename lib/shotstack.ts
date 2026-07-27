// Shotstack stitch provider — the only stitcher (Creatomate was removed).
// Set SHOTSTACK_ENV=production to use the paid endpoint. Default is 'stage', which
// is Shotstack's free sandbox (20 min/month, no card required, watermark-free).

const SHOTSTACK_BASE = process.env.SHOTSTACK_ENV === 'production'
  ? 'https://api.shotstack.io/edge'
  : 'https://api.shotstack.io/stage'

export async function submitStitchJob({
  talkingHeadUrl,
  talkingHeadDuration,
  additionalTalkingHeadUrls,
  broll1Url,
  broll2Url,
  audioOverlayUrl,
  spokenScript,
  syncedCaptions,
  watermark,
  aspect,
  uiScreenshotUrl,
}: {
  talkingHeadUrl: string
  talkingHeadDuration?: number  // seconds of EACH talking-head clip (used to position and concat)
  additionalTalkingHeadUrls?: string[]  // Chained Kling clips — concatenated after primary on same track
  broll1Url?: string
  broll2Url?: string
  audioOverlayUrl?: string      // Hero tier: ElevenLabs/OpenAI voice — mutes talking-head audio
  spokenScript?: string         // Fallback caption source if Whisper sync unavailable
  syncedCaptions?: Array<{ text: string; start: number; end: number }>  // Whisper word-timed chunks
  watermark?: boolean           // Free-tier flag — overlays "Made with ContentFlow" bottom-right
  aspect?: 'portrait' | 'square' | 'landscape'  // Drives the render output size
  uiScreenshotUrl?: string      // Software mode: UI screenshot composited as background behind chroma-keyed character
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
  // Per-clip length (talkingHeadDuration is the length of each individual Kling clip).
  // Total length = clipCount * perClip, used for caption distribution + overlays.
  const talkingHeadStart = 0
  const perClipLength = talkingHeadDuration && talkingHeadDuration > 0 ? talkingHeadDuration : 12
  const allTalkingHeadUrls = [talkingHeadUrl, ...(additionalTalkingHeadUrls ?? [])]
  const talkingHeadLength = perClipLength * allTalkingHeadUrls.length
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

  // === Track 1 (bottom): talking head clip(s) — concatenated sequentially with audio ===
  // For chained Kling clips, each clip gets its own slot on the same track.
  const talkingHeadClips = allTalkingHeadUrls.map((src, i) => ({
    asset: {
      type: 'video',
      src,
      volume: audioOverlayUrl ? 0 : 1,
    },
    start: talkingHeadStart + perClipLength * i,
    length: perClipLength,
    fit: 'cover',
  }))

  const tracks: Record<string, unknown>[] = [{ clips: talkingHeadClips }]

  // === Software mode: UI screenshot as bottom background layer ===
  // When uiScreenshotUrl is provided, the talking-head video uses chroma key to
  // remove the green screen (#00B140), revealing the UI screenshot behind it.
  // The UI background track must be inserted AFTER so it ends up below the talking-head.
  if (uiScreenshotUrl) {
    // Modify the talking-head clips to use chroma key
    const chromaTalkingHeadClips = allTalkingHeadUrls.map((src, i) => ({
      asset: {
        type: 'video',
        src,
        volume: audioOverlayUrl ? 0 : 1,
        chromaKey: {
          color: '#00B140',
          threshold: 0.35,
          feathering: 0.05,
        },
      },
      start: talkingHeadStart + perClipLength * i,
      length: perClipLength,
      fit: 'cover',
    }))
    // Replace the existing talking-head track with the chroma-keyed version
    tracks[0] = { clips: chromaTalkingHeadClips }

    // Insert UI screenshot as background (bottom track — push to the end, it renders below)
    tracks.push({
      clips: [{
        asset: {
          type: 'image',
          src: uiScreenshotUrl,
        },
        start: 0,
        length: talkingHeadLength,
        fit: 'cover',
      }],
    })
  }

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

// Screen Demo: screen recording + AI voiceover mixed. Much simpler than UGC —
// no talking head, no B-roll, just video + audio + optional captions + watermark.
export async function submitScreenDemoJob({
  screenRecordingUrl,
  voiceoverUrl,
  voiceoverDuration,
  spokenScript,
  watermark,
  aspect,
}: {
  screenRecordingUrl: string
  voiceoverUrl: string
  voiceoverDuration?: number  // actual audio duration in seconds (from buffer size)
  spokenScript?: string
  watermark?: boolean
  aspect?: 'portrait' | 'square' | 'landscape'
}): Promise<{ renderId: string }> {
  const apiKey = process.env.SHOTSTACK_API_KEY
  if (!apiKey) throw new Error('SHOTSTACK_API_KEY not configured')

  // Use actual voiceover duration when available; fall back to script-length estimate.
  // Add 0.5s tail so the last syllable isn't cut off at the exact frame boundary.
  const estimatedDuration = voiceoverDuration
    ? voiceoverDuration + 0.5
    : Math.max(15, Math.ceil((spokenScript?.length ?? 150) / 10))

  const outputSize =
    aspect === 'square'    ? { width: 1080, height: 1080 } :
    aspect === 'portrait'  ? { width: 1080, height: 1920 } :
                             { width: 1920, height: 1080 }  // landscape default

  const tracks: Record<string, unknown>[] = [
    // Track 1 (bottom): screen recording, muted — voiceover carries the audio
    {
      clips: [{
        asset: { type: 'video', src: screenRecordingUrl, volume: 0 },
        start: 0,
        length: estimatedDuration,
        fit: 'contain',
      }],
    },
    // Track 2: AI voiceover audio
    {
      clips: [{
        asset: { type: 'audio', src: voiceoverUrl, volume: 1 },
        start: 0,
        length: estimatedDuration,
      }],
    },
  ]

  // Captions from script (script-based fallback, same as UGC stitch)
  if (spokenScript?.trim()) {
    const captionClips = buildCaptionClips(spokenScript.trim(), 0, estimatedDuration)
    if (captionClips.length) tracks.unshift({ clips: captionClips })
  }

  if (watermark) {
    tracks.unshift({
      clips: [{
        asset: {
          type: 'html',
          html: '<p>Made with ContentFlow</p>',
          css: 'p { font-family: "Inter", sans-serif; font-size: 26px; font-weight: 700; color: #FFFFFF; text-shadow: 0 1px 3px rgba(0,0,0,0.7); margin: 0; padding: 6px 12px; background: rgba(0,0,0,0.45); border-radius: 6px; display: inline-block; white-space: nowrap; }',
          width: 380, height: 60, background: 'transparent',
        },
        start: 0,
        length: estimatedDuration,
        position: 'bottomRight',
        offset: { x: -0.02, y: 0.02 },
      }],
    })
  }

  const body = {
    timeline: { background: '#000000', tracks },
    output: { format: 'mp4', size: outputSize, fps: 30 },
  }

  const res = await fetch(`${SHOTSTACK_BASE}/render`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Shotstack ${res.status}: ${text.slice(0, 300)}`)
  }

  const data = await res.json()
  const renderId = data?.response?.id ?? data?.id
  if (!renderId) throw new Error(`Shotstack did not return a render ID: ${JSON.stringify(data)}`)
  return { renderId }
}

// Scroll-stop hook stitch: concat a trimmed hook clip in front of the main
// talking-head clip. Seedance's hard floor is 3s, but the design target for
// the hook is 1.5s — we absorb the delta by setting the hook clip's `length`
// to 1.5, which tells Shotstack to only play the first 1.5s before cutting
// to the next clip on the timeline. Audio + captions stay on both clips.
//
// Both clips render on the same track sequentially — hook at start=0 length=1.5,
// main at start=1.5 length=mainDuration.
export async function submitStitchWithHook({
  hookUrl,
  hookTrimTo,
  mainUrl,
  mainDuration,
  aspect,
}: {
  hookUrl: string
  hookTrimTo?: number       // How long the hook plays before cutting to main. Default 1.5s.
  mainUrl: string
  mainDuration?: number     // Estimated seconds; falls back to 12s if omitted.
  aspect?: 'portrait' | 'square' | 'landscape'
}): Promise<{ renderId: string }> {
  const apiKey = process.env.SHOTSTACK_API_KEY
  if (!apiKey) throw new Error('SHOTSTACK_API_KEY not configured')

  const hookLength = typeof hookTrimTo === 'number' && hookTrimTo > 0 ? hookTrimTo : 1.5
  const mainLen = typeof mainDuration === 'number' && mainDuration > 0 ? mainDuration : 12

  const tracks: Record<string, unknown>[] = [{
    clips: [
      {
        asset: { type: 'video', src: hookUrl, volume: 1 },
        start: 0,
        length: hookLength,
        fit: 'cover',
      },
      {
        asset: { type: 'video', src: mainUrl, volume: 1 },
        start: hookLength,
        length: mainLen,
        fit: 'cover',
      },
    ],
  }]

  const outputSize =
    aspect === 'square'    ? { width: 1080, height: 1080 } :
    aspect === 'landscape' ? { width: 1920, height: 1080 } :
                             { width: 1080, height: 1920 }

  const body = {
    timeline: { background: '#000000', tracks },
    output: { format: 'mp4', size: outputSize, fps: 30 },
  }

  const res = await fetch(`${SHOTSTACK_BASE}/render`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('[shotstack] hook stitch rejected', { status: res.status, detail: text.slice(0, 400) })
    throw new Error(`Shotstack ${res.status}: ${text.slice(0, 300)}`)
  }
  const data = await res.json()
  const renderId = data?.response?.id ?? data?.id
  if (!renderId) throw new Error('Shotstack: no render id returned for hook stitch')
  return { renderId }
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

// ── Editor server-side render ────────────────────────────────────────────
// Replaces the browser MediaRecorder export (realtime canvas capture drops
// frames under encoder load — "low fps" exports). Shotstack renders the
// same edit in the cloud at a locked 30fps and returns a proper MP4.
export async function submitEditorRender(input: {
  videoUrl: string
  trimStart: number
  trimEnd: number
  speed?: number
  fadeIn?: boolean
  fadeOut?: boolean
  overlays?: Array<{ text: string; start: number; duration: number; y?: number; size?: number; color?: string }>
  music?: { url: string; volume?: number }
  aspectRatio?: '9:16' | '1:1' | '16:9'
}): Promise<{ renderId: string }> {
  const apiKey = process.env.SHOTSTACK_API_KEY
  if (!apiKey) throw new Error('SHOTSTACK_API_KEY not configured')

  const speed = input.speed && input.speed > 0 ? input.speed : 1
  const srcLength = Math.max(0.5, input.trimEnd - input.trimStart)
  const outLength = srcLength / speed

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const videoAsset: Record<string, any> = {
    type: 'video',
    src: input.videoUrl,
    trim: Math.max(0, input.trimStart),
    volume: 1,
  }
  if (speed !== 1) videoAsset.speed = speed

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const videoClip: Record<string, any> = {
    asset: videoAsset,
    start: 0,
    length: outLength,
    fit: 'cover',
  }
  if (input.fadeIn || input.fadeOut) {
    videoClip.transition = {
      ...(input.fadeIn ? { in: 'fade' } : {}),
      ...(input.fadeOut ? { out: 'fade' } : {}),
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tracks: Array<{ clips: Record<string, any>[] }> = []

  // Text overlays (top track).
  const overlayClips = (input.overlays ?? []).map(ov => ({
    asset: {
      type: 'html',
      html: `<p>${ov.text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`,
      css: `p { font-family: 'Montserrat ExtraBold', sans-serif; font-size: ${ov.size ?? 30}px; color: ${ov.color ?? '#ffffff'}; text-align: center; text-shadow: 0 2px 12px rgba(0,0,0,0.75); }`,
      width: 900,
      height: 200,
    },
    start: Math.max(0, ov.start),
    length: Math.max(0.3, ov.duration),
    position: 'center',
    // Map 0..1 (top..bottom) to Shotstack offset (+0.5..-0.5).
    offset: { y: typeof ov.y === 'number' ? Math.max(-0.5, Math.min(0.5, 0.5 - ov.y)) : -0.3 },
  }))
  if (overlayClips.length) tracks.push({ clips: overlayClips })

  tracks.push({ clips: [videoClip] })

  if (input.music?.url) {
    tracks.push({
      clips: [{
        asset: { type: 'audio', src: input.music.url, volume: input.music.volume ?? 0.5 },
        start: 0,
        length: outLength,
      }],
    })
  }

  const size =
    input.aspectRatio === '16:9' ? { width: 1920, height: 1080 } :
    input.aspectRatio === '1:1'  ? { width: 1080, height: 1080 } :
                                   { width: 1080, height: 1920 }

  const body = {
    timeline: { background: '#000000', tracks },
    output: { format: 'mp4', fps: 30, size },
  }

  const res = await fetch(`${SHOTSTACK_BASE}/render`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('[shotstack] editor render rejected', { status: res.status, detail: detail.slice(0, 400) })
    throw new Error(`Shotstack render rejected (${res.status})`)
  }
  const data = await res.json()
  const renderId = data?.response?.id ?? data?.id
  if (!renderId) throw new Error('Shotstack: no render id returned')
  return { renderId }
}
