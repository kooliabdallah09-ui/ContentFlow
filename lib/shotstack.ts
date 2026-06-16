// Shotstack stitch provider — drop-in replacement for lib/creatomate.ts.
// Same public interface (submitStitchJob, getStitchStatus) so the route doesn't care
// which provider it's talking to.
//
// Set SHOTSTACK_ENV=production to use the paid endpoint. Default is 'stage', which
// is Shotstack's free sandbox (20 min/month, no card required, watermark-free).

const SHOTSTACK_BASE = process.env.SHOTSTACK_ENV === 'production'
  ? 'https://api.shotstack.io/edge'
  : 'https://api.shotstack.io/stage'

const TALKING_HEAD_ALIAS = 'talking_head'

export async function submitStitchJob({
  talkingHeadUrl,
  talkingHeadDuration,
  broll1Url,
  broll2Url,
  audioOverlayUrl,
}: {
  talkingHeadUrl: string
  talkingHeadDuration?: number  // seconds; used to position B-roll2 absolutely
  broll1Url?: string
  broll2Url?: string
  audioOverlayUrl?: string  // Hero tier: ElevenLabs voice — mutes talking-head audio
}): Promise<{ renderId: string }> {
  const apiKey = process.env.SHOTSTACK_API_KEY
  if (!apiKey) throw new Error('SHOTSTACK_API_KEY not configured')

  // Mirror the Creatomate timing exactly so the output feels identical:
  //   0–4s: B-roll1 (muted, fades out)
  //   3.7s: talking head starts (0.3s crossover)
  //   talking-head.end: B-roll2 appended (muted, fades in)
  const talkingHeadStart = broll1Url ? 3.7 : 0
  // Set the talking-head clip length explicitly so we can compute B-roll2's absolute
  // start. If duration is unknown, default to 12s (max Sora) — slightly long is harmless.
  const talkingHeadLength = talkingHeadDuration && talkingHeadDuration > 0 ? talkingHeadDuration : 12
  const talkingHeadEnd = talkingHeadStart + talkingHeadLength

  // Track 1 (bottom): main visual track
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
      // Mute the talking head when overlay audio is provided (Hero tier)
      volume: audioOverlayUrl ? 0 : 1,
    },
    alias: TALKING_HEAD_ALIAS,
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

  // Optional: ElevenLabs audio overlay (Hero tier) — its own track so it plays full volume.
  // Bound the length to the talking head so audio doesn't bleed over B-roll2.
  if (audioOverlayUrl) {
    tracks.push({
      clips: [{
        asset: { type: 'audio', src: audioOverlayUrl, volume: 1 },
        start: talkingHeadStart,
        length: talkingHeadLength,
      }],
    })
  }

  // TikTok-style auto-captions transcribed from the talking-head video.
  // Shotstack's caption asset src must be a video alias (or video URL) — it can't take
  // a raw audio URL. Even on Hero (where the talking-head audio is muted in playback),
  // Shotstack still transcribes from the underlying audio track of the clip, which
  // contains the same spoken script as the ElevenLabs overlay. So always alias.
  const captionSrc = `alias://${TALKING_HEAD_ALIAS}`
  tracks.unshift({
    clips: [{
      asset: {
        type: 'caption',
        src: captionSrc,
        font: {
          family: 'Inter',
          weight: 900,
          size: 64,
          color: '#FFFFFF',
          lineHeight: 1.1,
        },
        stroke: { color: '#000000', width: 4 },
        background: { color: 'transparent' },
        // Highlight active word in yellow — closest analog to Creatomate's transcript_effect
        highlight: { color: '#FFD400' },
      },
      start: talkingHeadStart,
      length: talkingHeadLength,
      position: 'bottom',
      offset: { y: -0.22 },  // push up to roughly 78% from the top of frame
    }],
  })

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
    let parsed: { message?: string; response?: { message?: string; error?: unknown }; error?: unknown } = {}
    try { parsed = JSON.parse(rawText) } catch {}
    const detail =
      parsed.response?.message
      || parsed.message
      || (parsed.response?.error ? JSON.stringify(parsed.response.error) : '')
      || (parsed.error ? JSON.stringify(parsed.error) : '')
      || rawText.slice(0, 400)
      || res.statusText
    console.error('[shotstack] render rejected', { status: res.status, detail, payload: body })
    throw new Error(`Shotstack ${res.status}: ${detail}`)
  }

  const data = await res.json()
  const renderId = data?.response?.id ?? data?.id
  if (!renderId) throw new Error(`Shotstack did not return a render ID. Response: ${JSON.stringify(data)}`)

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
