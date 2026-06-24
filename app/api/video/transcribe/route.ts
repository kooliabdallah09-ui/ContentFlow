import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { transcribeWithTimestamps, buildSyncedCaptionChunks } from '@/lib/whisper'

export const maxDuration = 120

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Server not configured')
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabase()
    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.slice(7))
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contentType = request.headers.get('content-type') ?? ''

    let videoUrl: string
    let videoDuration: number = 0

    if (contentType.includes('multipart/form-data')) {
      // Client uploaded a blob (local file) — store it in Supabase first
      const form = await request.formData()
      const file = form.get('file') as File | null
      if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })
      videoDuration = parseFloat((form.get('duration') as string) ?? '0')

      const MAX = 100 * 1024 * 1024 // 100MB
      if (file.size > MAX) return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 400 })

      const ext = file.name.split('.').pop() ?? 'mp4'
      const filename = `editor-transcribe/${userData.user.id}-${Date.now()}.${ext}`
      const buf = await file.arrayBuffer()
      const { error: upErr } = await supabase.storage
        .from('ugc-assets')
        .upload(filename, buf, { contentType: file.type || 'video/mp4', upsert: true })
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`)

      const { data: { publicUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
      videoUrl = publicUrl
    } else {
      // Remote URL — transcribe directly
      const body = await request.json()
      videoUrl = body.videoUrl
      videoDuration = body.duration ?? 0
      if (!videoUrl) return NextResponse.json({ error: 'Missing videoUrl' }, { status: 400 })
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 })
    }

    const { words, text } = await transcribeWithTimestamps(videoUrl)
    const chunks = buildSyncedCaptionChunks(words, { maxWords: 4 })

    // Convert to TextOverlay objects for the editor
    const overlays = chunks.map((chunk, i) => ({
      id: `cap-${i}-${Math.random().toString(36).slice(2, 7)}`,
      text: chunk.text,
      start: chunk.start,
      duration: Math.max(0.3, chunk.end - chunk.start),
      position: 'bottom' as const,
      style: 'caption' as const,
      x: 0.5,
      y: 0.85,
      color: '#ffffff',
      fontSize: 'md' as const,
    }))

    console.log('[transcribe] text:', text.slice(0, 200), '| words:', words.length, '| overlays:', overlays.length)
    return NextResponse.json({ overlays, fullText: text, duration: videoDuration, _debug: { wordCount: words.length, textSnippet: text.slice(0, 100) } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[transcribe]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
