// Server-side editor export via Shotstack.
// POST — submit the edit (trim/speed/fades/text/music) for cloud rendering.
// GET ?renderId= — poll status; returns { status, url } when done.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { submitEditorRender, getStitchStatus } from '@/lib/shotstack'

export const maxDuration = 60

async function authUser(request: NextRequest): Promise<string | null> {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data } = await supabase.auth.getUser(header.slice(7))
  return data.user?.id ?? null
}

export async function POST(request: NextRequest) {
  try {
    const userId = await authUser(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const videoUrl = String(body?.videoUrl ?? '')
    if (!videoUrl.startsWith('https://')) {
      return NextResponse.json({ error: 'Source video must be a public https URL' }, { status: 400 })
    }

    const { renderId } = await submitEditorRender({
      videoUrl,
      trimStart: Number(body?.trimStart) || 0,
      trimEnd: Number(body?.trimEnd) || 0,
      speed: Number(body?.speed) || 1,
      fadeIn: !!body?.fadeIn,
      fadeOut: !!body?.fadeOut,
      overlays: Array.isArray(body?.overlays) ? body.overlays.slice(0, 20) : [],
      music: body?.music?.url ? { url: String(body.music.url), volume: Number(body.music.volume) || 0.5 } : undefined,
      aspectRatio: body?.aspectRatio === '16:9' || body?.aspectRatio === '1:1' ? body.aspectRatio : '9:16',
    })
    return NextResponse.json({ renderId })
  } catch (err) {
    console.error('[editor/render] failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Render failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await authUser(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const renderId = request.nextUrl.searchParams.get('renderId')
    if (!renderId) return NextResponse.json({ error: 'Missing renderId' }, { status: 400 })
    const status = await getStitchStatus(renderId)
    return NextResponse.json(status)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Status failed' }, { status: 500 })
  }
}
