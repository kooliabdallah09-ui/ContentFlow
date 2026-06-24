import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateSpeech } from '@/lib/tts'
import { submitScreenDemoJob } from '@/lib/shotstack'

export const maxDuration = 120

const CHAR_BLOCK = 80
const MIN_CREDITS = 20
const MAX_CHARS = 2000

function calcCreditCost(charCount: number): number {
  return Math.max(MIN_CREDITS, Math.ceil(charCount / CHAR_BLOCK))
}

// Accepts JSON (not multipart) — video was already uploaded directly from the
// browser to Supabase using a signed URL from /api/screen-demo/upload-url.
export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.slice(7))
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = userData.user.id

    const body = await req.json()
    const { storagePath, script: rawScript, voiceId = 'Rachel', aspect = 'landscape' } = body
    const script = (rawScript ?? '').trim()

    if (!storagePath || typeof storagePath !== 'string') {
      return NextResponse.json({ error: 'storagePath is required' }, { status: 400 })
    }
    if (!script || script.length < 10) {
      return NextResponse.json({ error: 'Script is required (min 10 characters)' }, { status: 400 })
    }
    if (script.length > MAX_CHARS) {
      return NextResponse.json({ error: `Script must be under ${MAX_CHARS} characters` }, { status: 400 })
    }
    if (!['portrait', 'square', 'landscape'].includes(aspect)) {
      return NextResponse.json({ error: 'Invalid aspect ratio' }, { status: 400 })
    }

    const creditCost = calcCreditCost(script.length)

    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, plan')
      .eq('user_id', userId)
      .single()

    if (!credits || credits.balance < creditCost) {
      return NextResponse.json(
        { error: `Insufficient credits. Need ${creditCost}, have ${credits?.balance ?? 0}` },
        { status: 400 },
      )
    }

    // Get public URL for the already-uploaded screen recording
    const { data: { publicUrl: screenRecordingUrl } } = supabase.storage
      .from('ugc-assets')
      .getPublicUrl(storagePath)

    // Generate voiceover with ElevenLabs
    const audioBuf = await generateSpeech(script, voiceId, {})

    // Calculate actual audio duration from buffer size (ElevenLabs outputs MP3 at 128kbps)
    const voiceoverDuration = Math.round((audioBuf.byteLength / 16000) * 10) / 10 // seconds, 1 decimal

    const audioFilename = `screen-demo/${userId}-${Date.now()}-vo.mp3`
    const { error: audioUploadErr } = await supabase.storage
      .from('ugc-assets')
      .upload(audioFilename, audioBuf, { contentType: 'audio/mpeg', upsert: false })
    if (audioUploadErr) {
      return NextResponse.json({ error: `Audio upload failed: ${audioUploadErr.message}` }, { status: 500 })
    }
    const { data: { publicUrl: voiceoverUrl } } = supabase.storage
      .from('ugc-assets')
      .getPublicUrl(audioFilename)

    // Submit Shotstack render
    const { renderId } = await submitScreenDemoJob({
      screenRecordingUrl,
      voiceoverUrl,
      voiceoverDuration,
      spokenScript: script,
      watermark: credits.plan === 'free',
      aspect: aspect as 'portrait' | 'square' | 'landscape',
    })

    // Deduct credits
    const newBalance = credits.balance - creditCost
    await supabase.from('user_credits').update({ balance: newBalance }).eq('user_id', userId)
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: creditCost,
      transaction_type: 'generation',
      content_type: 'screen-demo',
      description: `Screen Demo · ${voiceId}`,
    })

    return NextResponse.json({ renderId, creditDeducted: creditCost, newBalance })
  } catch (err) {
    console.error('[screen-demo/generate]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 },
    )
  }
}
