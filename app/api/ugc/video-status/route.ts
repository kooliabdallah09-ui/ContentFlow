import { getVideoStatus } from '@/lib/heygen'
import { getBrollStatus } from '@/lib/kling'
import { getSoraStatus, downloadSoraVideo } from '@/lib/sora'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Rehost a Sora video to Supabase storage on the first poll that sees it as completed.
// OpenAI's /v1/videos/{id}/content requires the API key as auth, so the raw URL isn't usable
// by the browser or by Creatomate. We download once and rehost as a public Supabase URL.
async function rehostSoraVideo(videoId: string): Promise<string | undefined> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) return undefined

  const supabase = createClient(supabaseUrl, supabaseKey)
  const filename = `sora-output/${videoId}.mp4`

  // If we've already rehosted this video, return the existing URL — idempotent.
  const { data: existing } = await supabase.storage.from('ugc-assets').list('sora-output', { search: `${videoId}.mp4` })
  if (existing?.some(f => f.name === `${videoId}.mp4`)) {
    const { data: { publicUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
    return publicUrl
  }

  // First time — download from OpenAI, upload to Supabase, return the public URL.
  try {
    const buf = await downloadSoraVideo(videoId)
    const { error } = await supabase.storage.from('ugc-assets').upload(filename, buf, { contentType: 'video/mp4', upsert: false })
    if (error && !error.message?.includes('already exists')) {
      console.error('Failed to upload Sora video to Supabase:', error)
      return undefined
    }
    const { data: { publicUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
    return publicUrl
  } catch (err) {
    console.error('rehostSoraVideo failed:', err instanceof Error ? err.message : err)
    return undefined
  }
}

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get('videoId')
  const brollTaskIds = request.nextUrl.searchParams.get('brollTaskIds') // comma-separated
  const provider = request.nextUrl.searchParams.get('provider') // 'heygen' | 'sora-2'

  if (!videoId && !brollTaskIds) {
    return NextResponse.json({ error: 'Missing videoId or brollTaskIds' }, { status: 400 })
  }

  try {
    const result: Record<string, unknown> = {}

    if (videoId) {
      if (provider === 'sora-2') {
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
    }

    if (brollTaskIds && (process.env.REPLICATE_API_TOKEN || process.env.FAL_KEY || process.env.PIAPI_API_KEY)) {
      const ids = brollTaskIds.split(',').filter(Boolean)
      const statuses = await Promise.all(ids.map(id => getBrollStatus(id).catch(() => ({ status: 'failed' as const }))))
      result.broll = ids.map((id, i) => ({ taskId: id, ...statuses[i] }))
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to get status' }, { status: 500 })
  }
}
