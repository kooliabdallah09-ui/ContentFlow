// App Demo Composite renderer — implements the Gemini blueprint.
//
// Pipeline in order:
//   1. Kling v3 omni produces the talking-head clip (native background, native audio).
//   2. That clip is sent to Replicate (submitBackgroundRemovalJob) to get an
//      alpha-channel version — the "avatar cutout".
//   3. The state machine on the format template drives a Shotstack render:
//        Segment A (0-3s): B-roll layer 0, avatar-cutout layer 1 (scaled 45%)
//        Segment B (3-5.5s): raw Kling clip full-frame
//        Segment C (5.5-16s): app-UI layer 0, avatar-cutout layer 1
//   4. Whisper word timings drive the word-by-word caption clips + emoji
//      triggers on a higher track.
//
// This module builds the Shotstack Edit JSON. The orchestrating route handles
// polling + storage.

import type { StateMachineSegment, CaptionSpec, EmojiTrigger } from '../formats'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShotstackClip = Record<string, any>

const SHOTSTACK_BASE = process.env.SHOTSTACK_ENV === 'production'
  ? 'https://api.shotstack.io/edge'
  : 'https://api.shotstack.io/stage'

export interface BuildAppDemoInput {
  segments: StateMachineSegment[]
  captions: CaptionSpec
  triggers: EmojiTrigger[]
  totalSeconds: number
  canvas: { width: number; height: number }
  fps: number

  // Assets provided at render time.
  klingRawUrl: string           // talking-head with native background (State B uses this)
  avatarKeyedUrl: string        // alpha-channel version (States A and C composite this)
  brollUrl?: string             // background for State A (b_roll). Optional — if omitted, uses a grey fill.
  appUiUrl?: string             // background for State C (app_ui). Required if any segment is app_ui.
  words: Array<{ text: string; start: number; end: number }> // Whisper word timings
}

export interface RenderResult {
  renderId: string
}

// Build the Shotstack Edit spec for the app-demo composite and submit it.
export async function renderAppDemo(input: BuildAppDemoInput): Promise<RenderResult> {
  const apiKey = process.env.SHOTSTACK_API_KEY
  if (!apiKey) throw new Error('SHOTSTACK_API_KEY not configured')

  const clips: ShotstackClip[] = []

  // ---------- Segment layers ----------
  for (const seg of input.segments) {
    const segDur = seg.endSeconds - seg.startSeconds
    if (seg.state.kind === 'overlay') {
      // Layer 0: background video (b_roll or app_ui). Falls back to a solid
      // colour clip if the required URL is missing so the render still exits.
      const bgUrl = seg.state.background.type === 'app_ui'
        ? input.appUiUrl
        : input.brollUrl
      if (bgUrl) {
        clips.push(bgClip(bgUrl, seg.startSeconds, segDur))
      } else {
        clips.push(solidBgClip(seg.state.background.type === 'app_ui' ? '#111111' : '#0a1f3d', seg.startSeconds, segDur))
      }
      // Layer 1: avatar cutout scaled and pinned to bottom.
      const avatarHeightFraction = seg.state.avatarSize
      clips.push({
        asset: { type: 'video', src: input.avatarKeyedUrl, volume: 1 },
        start: seg.startSeconds,
        length: segDur,
        // Keep the raw Kling audio.
        // Scale so the avatar occupies avatarHeightFraction of the canvas.
        scale: avatarHeightFraction,
        // Position at bottom-center. Shotstack position offsets are in the
        // -1..1 range where -1 is left/top and 1 is right/bottom.
        offset: { x: 0, y: 0.5 - avatarHeightFraction / 2 - seg.state.avatarBottomInset },
        fit: 'none',
      })
    } else {
      // Fullscreen pivot — the raw Kling clip with native background and audio.
      clips.push({
        asset: { type: 'video', src: input.klingRawUrl, trim: seg.startSeconds, volume: 1 },
        start: seg.startSeconds,
        length: segDur,
        fit: 'cover',
      })
    }
  }

  // ---------- Word-by-word captions ----------
  const captionClips: ShotstackClip[] = []
  const emojiClips: ShotstackClip[] = []

  // Which segment does a given time belong to? Drives caption colour.
  const segmentAt = (t: number) =>
    input.segments.find(s => t >= s.startSeconds && t < s.endSeconds) ?? input.segments[input.segments.length - 1]

  const usedTriggers = new Set<string>()

  const maxWords = input.captions.maxWordsPerFrame

  // Group words into 1-2 word chunks based on the spec.
  for (let i = 0; i < input.words.length; i += maxWords) {
    const chunk = input.words.slice(i, i + maxWords)
    if (!chunk.length) continue
    const start = chunk[0].start
    const end = chunk[chunk.length - 1].end
    const seg = segmentAt(start)
    const text = chunk.map(w => w.text.toUpperCase()).join(' ')

    captionClips.push({
      asset: {
        type: 'title',
        text,
        style: 'blockbuster',    // bold sans-serif with heavy stroke
        color: seg.captionColor,
        size: 'large',
        position: 'center',
      },
      start,
      length: Math.max(0.1, end - start),
      offset: { x: input.captions.centerX - 0.5, y: 0.5 - input.captions.centerY },
      transition: { in: 'zoom' },
    })

    // Emoji + SFX trigger: fires once per keyword across the whole clip.
    for (const w of chunk) {
      const clean = w.text.toLowerCase().replace(/[^a-z]/g, '')
      if (!clean) continue
      const trig = input.triggers.find(t => t.keyword === clean)
      if (!trig || usedTriggers.has(trig.keyword)) continue
      usedTriggers.add(trig.keyword)
      emojiClips.push({
        asset: { type: 'title', text: trig.emoji, size: 'x-large', color: '#ffffff' },
        start: w.start,
        length: 1.2,
        offset: { x: input.captions.centerX - 0.5, y: 0.5 - input.captions.centerY + trig.yOffset },
        transition: { in: 'zoom', out: 'fade' },
      })
    }
  }

  // ---------- Assemble the timeline ----------
  const timeline = {
    background: '#000000',
    tracks: [
      { clips: emojiClips },
      { clips: captionClips },
      { clips: clips.filter((_, i) => clips.indexOf(_) % 2 === 0) },  // arranged below to preserve draw order
      { clips: clips.filter((_, i) => clips.indexOf(_) % 2 === 1) },
    ],
  }

  const output = {
    format: 'mp4',
    resolution: 'hd',
    aspectRatio: '9:16',
    fps: input.fps,
  }

  const editSpec = { timeline, output }

  const res = await fetch(`${SHOTSTACK_BASE}/render`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(editSpec),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Shotstack submit failed ${res.status}: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  const renderId: string | undefined = data?.response?.id
  if (!renderId) throw new Error(`Shotstack: no render id. Response: ${JSON.stringify(data)}`)

  return { renderId }
}

// --------------- Shotstack clip helpers ---------------

function bgClip(src: string, start: number, length: number): ShotstackClip {
  return {
    asset: { type: 'video', src, volume: 0 }, // mute — the Kling audio drives the whole clip
    start,
    length,
    fit: 'cover',
  }
}

function solidBgClip(color: string, start: number, length: number): ShotstackClip {
  return {
    asset: { type: 'title', text: ' ', color: '#ffffff', background: color, size: 'large' },
    start,
    length,
    fit: 'contain',
  }
}

export async function getAppDemoRenderStatus(renderId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  error?: string
}> {
  const apiKey = process.env.SHOTSTACK_API_KEY
  if (!apiKey) throw new Error('SHOTSTACK_API_KEY not configured')
  const res = await fetch(`${SHOTSTACK_BASE}/render/${renderId}`, {
    headers: { 'x-api-key': apiKey },
  })
  if (!res.ok) throw new Error(`Shotstack poll failed ${res.status}`)
  const data = await res.json()
  const status = data?.response?.status as string | undefined
  if (status === 'done') return { status: 'completed', videoUrl: data?.response?.url }
  if (status === 'failed') return { status: 'failed', error: data?.response?.error ?? 'unknown' }
  if (status === 'rendering' || status === 'fetching' || status === 'saving') return { status: 'processing' }
  return { status: 'pending' }
}
