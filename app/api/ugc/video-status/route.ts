import { getVideoStatus } from '@/lib/heygen'
import { getSoraStatus, downloadSoraVideo } from '@/lib/sora'
import { getSora2ReplicateStatus, getSeedanceStatus } from '@/lib/replicate'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Rehost a Sora video to Supabase storage on the first poll that sees it as completed.
// (Legacy: still used by the standalone /generate/video page which is on Sora.)
async function rehostSoraVideo(videoId: string): Promise<string | undefined> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) return undefined

  const supabase = createClient(supabaseUrl, supabaseKey)
  const filename = `sora-output/${videoId}.mp4`

  const { data: existing } = await supabase.storage.from('ugc-assets').list('sora-output', { search: `${videoId}.mp4` })
  if (existing?.some(f => f.name === `${videoId}.mp4`)) {
    const { data: { publicUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
    return publicUrl
  }

  try {
    const buf = await downloadSoraVideo(videoId)
    const { error } = await supabase.storage.from('ugc-assets').upload(filename, buf, { contentType: 'video/mp4', upsert: false })
    if (error && !error.message?.includes('already exists')) return undefined
    const { data: { publicUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
    return publicUrl
  } catch {
    return undefined
  }
}

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get('videoId')
  const chainedIds = request.nextUrl.searchParams.get('chainedIds') // comma-separated additional Kling prediction ids
  const provider = request.nextUrl.searchParams.get('provider') // 'heygen' | 'sora-2' | 'kling-v3-omni'

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 })
  }

  try {
    const result: Record<string, unknown> = {}

    if (provider === 'seedance' || provider === 'seedance-2') {
      // Seedance outputs a public Replicate-hosted URL — no rehost needed.
      const status = await getSeedanceStatus(videoId)
      result.video = status
    } else if (provider === 'sora-2-replicate') {
      const status = await getSora2ReplicateStatus(videoId)
      result.video = status
    } else if (provider === 'sora-2') {
      const status = await getSoraStatus(videoId)
      if (status.status === 'completed') {
        const videoUrl = await rehostSoraVideo(videoId)
        result.video = { ...status, videoUrl }
      } else {
        result.video = status
      }
    } else {
      result.video = await getVideoStatus(videoId)
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to get status' }, { status: 500 })
  }
}
