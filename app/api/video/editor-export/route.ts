import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { EditSpec } from '@/lib/edit-spec'

const SHOTSTACK_BASE = process.env.SHOTSTACK_ENV === 'production'
  ? 'https://api.shotstack.io/edge'
  : 'https://api.shotstack.io/stage'

function getAuthClients(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Server not configured')

  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized')

  const supabase = createClient(supabaseUrl, supabaseKey)
  const token = authHeader.slice(7)
  return { supabase, token }
}

function buildShotstackBody(spec: EditSpec) {
  const apiKey = process.env.SHOTSTACK_API_KEY
  if (!apiKey) throw new Error('SHOTSTACK_API_KEY not configured')

  const trimmedLength = (spec.trimEnd > 0 ? spec.trimEnd : spec.duration) - spec.trimStart

  const tracks: Record<string, unknown>[] = []

  // Text overlays track (top)
  if (spec.overlays.length > 0) {
    const textClips = spec.overlays.map(overlay => {
      const safeText = String(overlay.text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

      const css =
        overlay.style === 'bold-white'
          ? 'p { color: #ffffff; font-size: 40px; font-weight: 800; font-family: \'Montserrat\', sans-serif; text-align: center; text-shadow: 0 2px 8px rgba(0,0,0,0.8); }'
          : overlay.style === 'minimal'
          ? 'p { color: #ffffff; font-size: 32px; font-weight: 400; font-family: \'Inter\', sans-serif; text-align: center; opacity: 0.9; }'
          : 'p { color: #ffffff; font-size: 36px; font-weight: 700; font-family: \'Inter\', sans-serif; text-align: center; background: rgba(0,0,0,0.55); padding: 8px 14px; border-radius: 8px; }'

      const position =
        overlay.position === 'top' ? 'topCenter' :
        overlay.position === 'center' ? 'center' :
        'bottomCenter'

      const offsetY =
        overlay.position === 'bottom' ? -0.1 :
        overlay.position === 'top' ? 0.1 :
        0

      return {
        asset: {
          type: 'html',
          html: `<p>${safeText}</p>`,
          css,
          width: 600,
          height: 200,
        },
        start: overlay.start,
        length: overlay.duration,
        position,
        offset: { y: offsetY },
      }
    })
    tracks.push({ clips: textClips })
  }

  // Video track
  tracks.push({
    clips: [{
      asset: {
        type: 'video',
        src: spec.videoUrl,
        trim: spec.trimStart,
      },
      start: 0,
      length: trimmedLength,
      fit: 'cover',
    }],
  })

  // Music track
  if (spec.music) {
    tracks.push({
      clips: [{
        asset: {
          type: 'audio',
          src: spec.music.url,
          volume: spec.music.volume,
        },
        start: 0,
        length: trimmedLength,
      }],
    })
  }

  const outputSize =
    spec.aspectRatio === '1:1' ? { width: 1080, height: 1080 } :
    spec.aspectRatio === '16:9' ? { width: 1920, height: 1080 } :
    { width: 1080, height: 1920 }

  return {
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
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, token } = getAuthClients(request)

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const spec: EditSpec = body.spec
    if (!spec?.videoUrl) return NextResponse.json({ error: 'Missing spec.videoUrl' }, { status: 400 })

    const apiKey = process.env.SHOTSTACK_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'SHOTSTACK_API_KEY not configured' }, { status: 500 })

    const payload = buildShotstackBody(spec)

    const res = await fetch(`${SHOTSTACK_BASE}/render`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const rawText = await res.text().catch(() => '')
      let parsed: { message?: string; response?: { message?: string } } = {}
      try { parsed = JSON.parse(rawText) } catch {}
      const msg = parsed.response?.message || parsed.message || rawText.slice(0, 300) || res.statusText
      console.error('[editor-export] Shotstack rejected', { status: res.status, msg })
      return NextResponse.json({ error: `Shotstack ${res.status}: ${msg}` }, { status: 500 })
    }

    const data = await res.json()
    const renderId = data?.response?.id ?? data?.id
    if (!renderId) return NextResponse.json({ error: 'Shotstack did not return a render ID' }, { status: 500 })

    return NextResponse.json({ renderId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: e instanceof Error && e.message === 'Unauthorized' ? 401 : 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, token } = getAuthClients(request)

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const renderId = request.nextUrl.searchParams.get('renderId')
    if (!renderId) return NextResponse.json({ error: 'Missing renderId' }, { status: 400 })

    const apiKey = process.env.SHOTSTACK_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'SHOTSTACK_API_KEY not configured' }, { status: 500 })

    const res = await fetch(`${SHOTSTACK_BASE}/render/${renderId}`, {
      headers: { 'x-api-key': apiKey },
    })

    if (!res.ok) throw new Error(`Shotstack status check failed: ${res.statusText}`)

    const data = await res.json()
    const r = data?.response ?? data
    const rawStatus: string = r?.status ?? 'queued'
    const url: string | undefined = r?.url ?? undefined

    const mappedStatus =
      rawStatus === 'done' ? 'succeeded' :
      rawStatus === 'failed' ? 'failed' :
      rawStatus === 'rendering' || rawStatus === 'saving' ? 'rendering' :
      rawStatus === 'fetching' ? 'waiting' :
      'planned'

    return NextResponse.json({ status: mappedStatus, url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
