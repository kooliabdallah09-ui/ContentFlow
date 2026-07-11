// App Demo Composite renderer.
//
// Shotstack track order (top of frame → bottom of frame):
//   0. Emoji triggers    — 💰 🎮 📱 pops
//   1. Captions          — word-by-word HTML clips, per-segment colour
//   2. Audio             — a single silent-video-with-audio clip pulling the
//                          raw Kling clip's audio across the whole 16s
//   3. Avatar            — chroma-keyed green-screen clip (from RVM) pinned
//                          bottom-right at 45% height
//   4. Background        — b-roll / app-UI for overlay segments, or the raw
//                          Kling clip full-frame for the pivot
//
// Everything downstream (captions style, chroma-key, audio) mirrors the Video
// Editor's makeCaptionClip pattern so styling is consistent.
import type { StateMachineSegment, CaptionSpec, EmojiTrigger } from '../formats'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShotstackClip = Record<string, any>

// Use production edge — chroma-key + no watermark require the paid renderer.
const SHOTSTACK_BASE = process.env.SHOTSTACK_ENV === 'stage'
  ? 'https://api.shotstack.io/stage'
  : 'https://api.shotstack.io/edge'

export interface BuildAppDemoInput {
  segments: StateMachineSegment[]
  captions: CaptionSpec
  triggers: EmojiTrigger[]
  totalSeconds: number
  canvas: { width: number; height: number }
  fps: number

  klingRawUrl: string           // talking-head with native background + audio
  avatarKeyedUrl: string        // green-screen version from RVM (no audio)
  brollUrl?: string
  appUiUrl?: string
  words: Array<{ text: string; start: number; end: number }>
  avatarSide?: 'left' | 'right' | 'center'   // horizontal placement of the avatar
}

export interface RenderResult {
  renderId: string
}

export async function renderAppDemo(input: BuildAppDemoInput): Promise<RenderResult> {
  const apiKey = process.env.SHOTSTACK_API_KEY
  if (!apiKey) throw new Error('SHOTSTACK_API_KEY not configured')

  const bgClips: ShotstackClip[] = []
  const avatarClips: ShotstackClip[] = []
  const side = input.avatarSide ?? 'right'

  // Background + avatar per segment.
  for (const seg of input.segments) {
    const segDur = seg.endSeconds - seg.startSeconds
    if (seg.state.kind === 'overlay') {
      const bgUrl = seg.state.background.type === 'app_ui' ? input.appUiUrl : input.brollUrl
      if (bgUrl) {
        bgClips.push(bgVideo(bgUrl, seg.startSeconds, segDur))
      } else {
        bgClips.push(bgSolid(seg.state.background.type === 'app_ui' ? '#111827' : '#0a1f3d', seg.startSeconds, segDur))
      }

      const avatarHeightFraction = seg.state.avatarSize
      const xOffset = side === 'left' ? -0.30 : side === 'right' ? 0.30 : 0
      avatarClips.push({
        asset: {
          type: 'video',
          src: input.avatarKeyedUrl,
          volume: 0, // audio comes from the dedicated audio track below
          chromaKey: { color: '#00FF00', threshold: 60, halo: 40 },
        },
        start: seg.startSeconds,
        length: segDur,
        scale: avatarHeightFraction,
        offset: { x: xOffset, y: 0.5 - avatarHeightFraction / 2 - seg.state.avatarBottomInset },
        fit: 'none',
      })
    } else {
      // Fullscreen pivot — raw Kling video, muted here (audio track handles sound).
      bgClips.push({
        asset: { type: 'video', src: input.klingRawUrl, trim: seg.startSeconds, volume: 0 },
        start: seg.startSeconds,
        length: segDur,
        fit: 'cover',
      })
    }
  }

  // Dedicated audio track — the raw Kling clip played invisibly across the
  // whole 16s so the actor's voice is continuous through overlay + pivot.
  const audioTrack: ShotstackClip[] = [{
    asset: { type: 'audio', src: input.klingRawUrl, volume: 1 },
    start: 0,
    length: input.totalSeconds,
  }]

  // Captions — HTML title clips, matching the Video Editor style.
  const captionClips: ShotstackClip[] = []
  const emojiClips: ShotstackClip[] = []
  const usedTriggers = new Set<string>()

  const segmentAt = (t: number) =>
    input.segments.find(s => t >= s.startSeconds && t < s.endSeconds) ?? input.segments[input.segments.length - 1]

  const maxWords = input.captions.maxWordsPerFrame
  for (let i = 0; i < input.words.length; i += maxWords) {
    const chunk = input.words.slice(i, i + maxWords)
    if (!chunk.length) continue
    const start = chunk[0].start
    const end = chunk[chunk.length - 1].end
    const seg = segmentAt(start)
    const text = chunk.map(w => w.text).join(' ')
    captionClips.push(makeCaptionClip(text, seg.captionColor, start, Math.max(0.15, end - start)))

    for (const w of chunk) {
      const clean = w.text.toLowerCase().replace(/[^a-z]/g, '')
      if (!clean) continue
      const trig = input.triggers.find(t => t.keyword === clean)
      if (!trig || usedTriggers.has(trig.keyword)) continue
      usedTriggers.add(trig.keyword)
      emojiClips.push({
        asset: {
          type: 'html',
          html: `<p>${trig.emoji}</p>`,
          css: 'p{font-size:16vh;margin:0;text-align:center;}',
          width: 400,
          height: 400,
          background: 'transparent',
        },
        start: w.start,
        length: 1.2,
        offset: { x: 0, y: trig.yOffset },
        position: 'center',
        transition: { in: 'zoom', out: 'fade' },
      })
    }
  }

  const timeline = {
    background: '#000000',
    tracks: [
      { clips: emojiClips },
      { clips: captionClips },
      { clips: audioTrack },
      { clips: avatarClips },
      { clips: bgClips },
    ],
  }

  const output = { format: 'mp4', resolution: 'hd', aspectRatio: '9:16', fps: input.fps }
  const editSpec = { timeline, output }

  const res = await fetch(`${SHOTSTACK_BASE}/render`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
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

// ---- helpers ----

function bgVideo(src: string, start: number, length: number): ShotstackClip {
  return {
    asset: { type: 'video', src, volume: 0 },
    start,
    length,
    fit: 'cover',
  }
}

function bgSolid(color: string, start: number, length: number): ShotstackClip {
  return {
    asset: { type: 'html', html: '<div></div>', css: `div{width:100%;height:100%;background:${color};}`, width: 1080, height: 1920, background: color },
    start,
    length,
  }
}

// TikTok/Video-Editor style caption. Bold Inter, dark backing pill so it reads
// on any background, per-segment colour from the state machine.
function makeCaptionClip(text: string, color: string, start: number, length: number): ShotstackClip {
  const safe = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return {
    asset: {
      type: 'html',
      html: `<p>${safe}</p>`,
      css: `p{font-family:"Inter","Montserrat",sans-serif;font-size:5.5vh;font-weight:900;line-height:1.05;color:${color};text-align:center;margin:0;padding:12px 18px;background:rgba(0,0,0,0.55);border-radius:14px;display:inline-block;max-width:88%;text-transform:uppercase;letter-spacing:0.5px;-webkit-text-stroke:2px rgba(0,0,0,0.85);}`,
      width: 900,
      height: 240,
      background: 'transparent',
    },
    start,
    length,
    position: 'center',
    offset: { x: 0, y: 0.10 },
    transition: { in: 'zoom', out: 'fade' },
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
