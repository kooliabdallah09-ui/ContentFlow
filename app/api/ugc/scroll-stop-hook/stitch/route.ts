// Scroll-stop hook stitch endpoint.
//
// POST: submit a Shotstack render that concatenates a hook clip (trimmed to
//   ~1.5s) with the main talking-head clip. Admin-gated to mirror the hook
//   render route itself.
// GET:  poll the render by renderId, return { status, videoUrl?, error? }.
//
// Seedance's hard 3s floor is absorbed here — the hook clip's Shotstack
// `length` is set to 1.5s so only the first half plays before cutting to
// the main clip.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { submitStitchWithHook, getStitchStatus } from '@/lib/shotstack'
import { canAccessScrollStopHook } from '@/lib/pov-access'

export const maxDuration = 60

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
    if (!canAccessScrollStopHook(userData.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const hookUrl = typeof body.hookUrl === 'string' ? body.hookUrl : ''
    const mainUrl = typeof body.mainUrl === 'string' ? body.mainUrl : ''
    if (!hookUrl || !mainUrl) {
      return NextResponse.json({ error: 'hookUrl and mainUrl required' }, { status: 400 })
    }
    const hookTrimTo = typeof body.hookTrimTo === 'number' ? body.hookTrimTo : 1.5
    const mainDuration = typeof body.mainDuration === 'number' ? body.mainDuration : undefined
    const aspect: 'portrait' | 'square' | 'landscape' =
      body.aspect === 'landscape' || body.aspect === 'square' ? body.aspect : 'portrait'

    const { renderId } = await submitStitchWithHook({
      hookUrl,
      hookTrimTo,
      mainUrl,
      mainDuration,
      aspect,
    })
    return NextResponse.json({ renderId })
  } catch (err) {
    console.error('[scroll-stop-hook/stitch] failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Stitch submit failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const renderId = request.nextUrl.searchParams.get('renderId')
  if (!renderId) return NextResponse.json({ error: 'Missing renderId' }, { status: 400 })
  try {
    const r = await getStitchStatus(renderId)
    // Normalise into the shape used by the crush-test poll code: completed | failed | processing.
    const status = r.status === 'succeeded' ? 'completed' : r.status === 'failed' ? 'failed' : 'processing'
    return NextResponse.json({ status, videoUrl: r.url, error: r.error })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Status check failed' }, { status: 500 })
  }
}
