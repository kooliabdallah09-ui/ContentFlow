import { getVideoStatus } from '@/lib/heygen'
import { getSeedanceStatus } from '@/lib/seedance'
import { getOmniFlashStatus, isOmniFlashId } from '@/lib/vertex-video'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Vertex Video returns the finished clip as base64 or a signed GCS URI. In
// both cases we rehost to Supabase so the client can use a plain public URL.
async function rehostOmniFlashVideo(operationId: string, videoBase64?: string, videoUrl?: string, mimeType = 'video/mp4'): Promise<string | undefined> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) return undefined
  const supabase = createClient(supabaseUrl, supabaseKey)
  // Reuse the same filename across polls so a slow second poll doesn't
  // trigger a duplicate upload.
  const stableId = operationId.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 60)
  const filename = `omni-output/${stableId}.mp4`
  const { data: existing } = await supabase.storage.from('ugc-assets').list('omni-output', { search: `${stableId}.mp4` })
  if (existing?.some(f => f.name === `${stableId}.mp4`)) {
    return supabase.storage.from('ugc-assets').getPublicUrl(filename).data.publicUrl
  }
  try {
    let buf: Buffer
    if (videoBase64) {
      buf = Buffer.from(videoBase64, 'base64')
    } else if (videoUrl) {
      const r = await fetch(videoUrl)
      if (!r.ok) return undefined
      buf = Buffer.from(await r.arrayBuffer())
    } else {
      return undefined
    }
    const { error } = await supabase.storage.from('ugc-assets').upload(filename, buf, { contentType: mimeType, upsert: false })
    if (error && !error.message?.includes('already exists')) return undefined
    return supabase.storage.from('ugc-assets').getPublicUrl(filename).data.publicUrl
  } catch { return undefined }
}

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get('videoId')
  const provider = request.nextUrl.searchParams.get('provider') // 'heygen' | 'seedance' | 'omni-flash'

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 })
  }

  try {
    const result: Record<string, unknown> = {}

    if (provider === 'omni-flash' || isOmniFlashId(videoId)) {
      const status = await getOmniFlashStatus(videoId)
      if (status.status === 'completed') {
        const rehostedUrl = await rehostOmniFlashVideo(videoId, status.videoBase64, status.videoUrl, status.mimeType)
        result.video = { status: 'completed', videoUrl: rehostedUrl ?? status.videoUrl }
      } else {
        result.video = status
      }
    } else if (provider === 'seedance' || provider === 'seedance-2') {
      // Seedance runs on BytePlus — no rehost needed, output URL is already public.
      const status = await getSeedanceStatus(videoId)
      result.video = status
    } else {
      result.video = await getVideoStatus(videoId)
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to get status' }, { status: 500 })
  }
}
