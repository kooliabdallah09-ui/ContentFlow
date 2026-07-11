import { getVideoStatus } from '@/lib/heygen'
import { getSoraStatus, downloadSoraVideo } from '@/lib/sora'
import { getKlingV3OmniStatus, getSora2ReplicateStatus, getSeedanceStatus } from '@/lib/replicate'
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

    if (provider === 'kling-v3-omni') {
      // Kling v3 omni outputs a public Replicate-hosted URL — no rehost needed.
      const primary = await getKlingV3OmniStatus(videoId)
      const extras = chainedIds
        ? await Promise.all(chainedIds.split(',').filter(Boolean).map(id =>
            getKlingV3OmniStatus(id).catch(() => ({ status: 'failed' as const, error: 'poll failed', videoUrl: undefined as string | undefined })),
          ))
        : []

      // Aggregate status: still processing if any clip is incomplete.
      const allClips = [primary, ...extras]
      const anyFailed = allClips.some(c => c.status === 'failed')
      const allDone = allClips.every(c => c.status === 'completed' && c.videoUrl)

      const status = anyFailed ? 'failed' : allDone ? 'completed' : 'processing'
      const videoUrls = allClips.map(c => c.videoUrl).filter((u): u is string => !!u)

      result.video = {
        status,
        videoUrl: videoUrls[0],   // primary clip URL
        videoUrls,                // all clips in order (for chained durations)
        clipStatuses: allClips.map(c => c.status),
        error: anyFailed ? allClips.find(c => c.status === 'failed')?.error : undefined,
      }
    } else if (provider === 'seedance' || provider === 'seedance-2') {
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
