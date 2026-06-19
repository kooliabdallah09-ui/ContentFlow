import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateSpeech } from '@/lib/tts'

// POST { text, voiceId, language? } → { audioUrl, creditDeducted, newBalance }
// ElevenLabs only, via Replicate (elevenlabs/turbo-v2.5).
// Pricing: $0.05 / 1000 chars Replicate cost. We charge ceil(chars/250) credits
// min 3, giving ~2x markup at long inputs (1 cr = $0.025).
const CHAR_BLOCK = 250
const MIN_CREDITS = 3
const MAX_CHARS = 2000

function calcCreditCost(text: string): number {
  return Math.max(MIN_CREDITS, Math.ceil(text.length / CHAR_BLOCK))
}

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
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    const voiceId = typeof body.voiceId === 'string' ? body.voiceId.trim() : 'Rachel'

    if (!text || text.length < 3) {
      return NextResponse.json({ error: 'Text is required (min 3 characters)' }, { status: 400 })
    }
    if (text.length > MAX_CHARS) {
      return NextResponse.json({ error: `Text must be under ${MAX_CHARS} characters` }, { status: 400 })
    }

    const CREDIT_COST = calcCreditCost(text)

    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', userId)
      .single()

    if (!credits || credits.balance < CREDIT_COST) {
      return NextResponse.json(
        { error: `Insufficient credits. Need ${CREDIT_COST}, have ${credits?.balance ?? 0}` },
        { status: 400 },
      )
    }

    const audioBuf = await generateSpeech(text, voiceId)

    const filename = `voiceover/${userId}-${Date.now()}.mp3`
    const { error: uploadErr } = await supabase.storage
      .from('ugc-assets')
      .upload(filename, audioBuf, { contentType: 'audio/mpeg', upsert: false })
    if (uploadErr) {
      return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 })
    }

    const { data: { publicUrl: audioUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(filename)

    const newBalance = credits.balance - CREDIT_COST
    await supabase.from('user_credits').update({ balance: newBalance }).eq('user_id', userId)
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: CREDIT_COST,
      transaction_type: 'generation',
      content_type: 'voiceover',
      description: `Voiceover · ${voiceId}`,
    })

    return NextResponse.json({ audioUrl, creditDeducted: CREDIT_COST, newBalance })
  } catch (err) {
    console.error('voiceover error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 },
    )
  }
}
