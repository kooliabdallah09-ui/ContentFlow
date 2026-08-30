import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { transcribeAudioUrl, buildSyncedCaptionChunks } from '@/lib/scribe'

// ElevenLabs Scribe is synchronous (2-30s depending on duration), so this
// endpoint now does the full transcription + overlay build in one POST.
// The old submit + poll flow (Replicate Whisper) was needed because Whisper
// took 1-4 minutes; Scribe returns fast enough to stay under the 300s
// Fluid Compute ceiling even for longer clips.
export const maxDuration = 300

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

export async function POST(request: NextRequest) {
  try {
    await authenticate(request)

    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 500 })
    }

    const body = await request.json()
    const videoUrl: string = body.videoUrl
    const language: string | undefined = body.language  // ISO code, undefined = auto detect
    const duration: number = typeof body.duration === 'number' ? body.duration : 0
    if (!videoUrl) return NextResponse.json({ error: 'Missing videoUrl' }, { status: 400 })

    const { words, text } = await transcribeAudioUrl(videoUrl, { languageCode: language })
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
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
