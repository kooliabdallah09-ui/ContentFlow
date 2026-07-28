import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { submitVoxStitch } from '@/lib/shotstack'
import type { VoxBeat } from '@/lib/vox-beatmap'

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

    const body = await request.json()
    const beats = body.beats as VoxBeat[]
    const videoUrls = body.videoUrls as string[]
    const voiceoverUrl = body.voiceoverUrl as string
    const aspectId = typeof body.aspectId === 'string' ? body.aspectId : undefined

    if (!Array.isArray(beats) || beats.length === 0) {
      return NextResponse.json({ error: 'beats is required' }, { status: 400 })
    }
    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json({ error: 'videoUrls is required' }, { status: 400 })
    }
    if (typeof voiceoverUrl !== 'string' || !voiceoverUrl) {
      return NextResponse.json({ error: 'voiceoverUrl is required' }, { status: 400 })
    }

    // Align arrays — if some frames failed, skip those beats
    const validPairs: { beat: VoxBeat; url: string }[] = []
    for (let i = 0; i < beats.length; i++) {
      if (videoUrls[i] && typeof videoUrls[i] === 'string' && videoUrls[i].startsWith('http')) {
        validPairs.push({ beat: beats[i], url: videoUrls[i] })
      }
    }
    if (validPairs.length === 0) {
      return NextResponse.json({ error: 'No valid video URLs' }, { status: 400 })
    }

    const aspect: 'portrait' | 'square' | 'landscape' =
      aspectId === 'square' ? 'square' : aspectId === 'landscape' ? 'landscape' : 'portrait'

    const { renderId } = await submitVoxStitch({
      beats: validPairs.map(p => p.beat),
      videoUrls: validPairs.map(p => p.url),
      voiceoverUrl,
      aspect,
    })

    return NextResponse.json({ renderId })
  } catch (err) {
    console.error('[vox/stitch] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Stitch failed' },
      { status: 500 },
    )
  }
}
