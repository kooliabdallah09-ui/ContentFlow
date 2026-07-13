// Multi-shot UGC composite.
//
// Once the client has confirmed the Kling anchor clip + all Seedance
// cutaways are done (via the existing /api/ugc/video-status polling), it
// hands us the finished mp4 URLs here. We stitch them on Shotstack:
//
//   Track 0 (top): b-roll cutaways at their planned start offsets. Silent.
//                  Between cutaways this track is transparent, so track 1
//                  shows through.
//   Track 1: the Kling anchor clip full-length, WITH its native audio.
//            This is what carries the voice across the whole ad.
//
// Voice continuity = Track 1 audio never stops. Video cuts happen on
// Track 0 only. Same architecture as the App Demo Composite.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 180

const SHOTSTACK_BASE = process.env.SHOTSTACK_ENV === 'production'
  ? 'https://api.shotstack.io/edge'
  : 'https://api.shotstack.io/stage'

interface Cutaway {
  videoUrl: string
  startAt: number       // seconds into the anchor timeline
  duration: number      // seconds
  slot?: string
}

interface Body {
  anchorUrl: string
  anchorDuration: number
  cutaways: Cutaway[]
  aspectRatio?: '9:16' | '1:1' | '16:9'
  fps?: number
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const apiKey = process.env.SHOTSTACK_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'SHOTSTACK_API_KEY not configured' }, { status: 500 })

    const body = (await request.json()) as Body
    if (!body.anchorUrl?.startsWith('http')) {
      return NextResponse.json({ error: 'Missing anchorUrl' }, { status: 400 })
    }
    const anchorDuration = Number(body.anchorDuration)
    if (!Number.isFinite(anchorDuration) || anchorDuration <= 0) {
      return NextResponse.json({ error: 'Missing anchorDuration' }, { status: 400 })
    }
    const cutaways = Array.isArray(body.cutaways) ? body.cutaways : []
    const aspectRatio = body.aspectRatio ?? '9:16'
    const fps = body.fps ?? 30

    // Anchor clip on the bottom track — its audio drives the whole ad.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anchorClip: any = {
      asset: { type: 'video', src: body.anchorUrl, volume: 1 },
      start: 0,
      length: anchorDuration,
      fit: 'cover',
    }

    // Cutaways on the overlay track — silent.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const overlayClips: any[] = cutaways
      .filter(c => c.videoUrl?.startsWith('http') && Number.isFinite(c.startAt) && Number.isFinite(c.duration))
      .map(c => ({
        asset: { type: 'video', src: c.videoUrl, volume: 0 },
        start: Math.max(0, c.startAt),
        length: Math.min(c.duration, Math.max(0.5, anchorDuration - c.startAt)),
        fit: 'cover',
        transition: { in: 'fade', out: 'fade' },
      }))

    const timeline = {
      background: '#000000',
      tracks: [
        { clips: overlayClips },
        { clips: [anchorClip] },
      ].filter(t => t.clips.length > 0),
    }

    const output = { format: 'mp4', resolution: 'hd', aspectRatio, fps }
    const editSpec = { timeline, output }

    const res = await fetch(`${SHOTSTACK_BASE}/render`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(editSpec),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({ error: `Shotstack submit failed ${res.status}: ${JSON.stringify(err)}` }, { status: 500 })
    }
    const data = await res.json()
    const renderId: string | undefined = data?.response?.id
    if (!renderId) return NextResponse.json({ error: 'Shotstack: no render id' }, { status: 500 })
    return NextResponse.json({ renderId })
  } catch (err) {
    console.error('ugc/multishot-composite error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Composite failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const renderId = request.nextUrl.searchParams.get('renderId')
    if (!renderId) return NextResponse.json({ error: 'Missing renderId' }, { status: 400 })
    const apiKey = process.env.SHOTSTACK_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'SHOTSTACK_API_KEY not configured' }, { status: 500 })
    const res = await fetch(`${SHOTSTACK_BASE}/render/${renderId}`, {
      headers: { 'x-api-key': apiKey },
    })
    if (!res.ok) return NextResponse.json({ error: `Shotstack poll ${res.status}` }, { status: 500 })
    const data = await res.json()
    const status = data?.response?.status as string | undefined
    if (status === 'done') return NextResponse.json({ status: 'completed', videoUrl: data?.response?.url })
    if (status === 'failed') return NextResponse.json({ status: 'failed', error: data?.response?.error ?? 'unknown' })
    if (status === 'rendering' || status === 'fetching' || status === 'saving') return NextResponse.json({ status: 'processing' })
    return NextResponse.json({ status: 'pending' })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Poll failed' }, { status: 500 })
  }
}
