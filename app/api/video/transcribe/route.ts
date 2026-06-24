import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { startTranscription, pollTranscription, buildSyncedCaptionChunks } from '@/lib/whisper'

export const maxDuration = 30

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Server not configured')
  return createClient(url, key)
}

async function authenticate(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized')
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.getUser(authHeader.slice(7))
  if (error || !data.user) throw new Error('Unauthorized')
  return data.user
}

// POST — submit the Replicate job and return a predictionId immediately
export async function POST(request: NextRequest) {
  try {
    await authenticate(request)

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 })
    }

    const body = await request.json()
    const videoUrl: string = body.videoUrl
    const language: string | undefined = body.language  // e.g. 'en', 'fr' — undefined = auto detect
    if (!videoUrl) return NextResponse.json({ error: 'Missing videoUrl' }, { status: 400 })

    const predictionId = await startTranscription(videoUrl, language)
    return NextResponse.json({ predictionId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: e instanceof Error && msg === 'Unauthorized' ? 401 : 500 })
  }
}

// GET — poll Replicate once and return status + overlays when done
export async function GET(request: NextRequest) {
  try {
    await authenticate(request)

    const predictionId = request.nextUrl.searchParams.get('predictionId')
    if (!predictionId) return NextResponse.json({ error: 'Missing predictionId' }, { status: 400 })

    const duration = parseFloat(request.nextUrl.searchParams.get('duration') ?? '0')

    const { done, result, error } = await pollTranscription(predictionId)

    if (!done) return NextResponse.json({ status: 'processing' })
    if (error) return NextResponse.json({ error: `Transcription failed: ${error}` }, { status: 500 })

    const { words, text } = result!
    const chunks = buildSyncedCaptionChunks(words, { maxWords: 4 })

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

    return NextResponse.json({ status: 'done', overlays, fullText: text, duration })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
