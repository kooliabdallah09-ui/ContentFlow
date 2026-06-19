import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateSpeech } from '@/lib/tts'

// POST { text, voiceId } → { audioUrl, creditDeducted, newBalance }
// Routes ElevenLabs voices through Replicate (REPLICATE_API_TOKEN) and
// OpenAI voices (openai:*) through OpenAI TTS.
//
// Pricing (1 cr = $0.025 USD):
//   ElevenLabs via Replicate (~$0.25-0.40/1000 chars): ceil(chars/100)*2 cr, min 8
//   OpenAI TTS-1-HD ($0.030/1000 chars): flat 5 cr — cheap enough at any length
const OPENAI_CREDITS = 5
const EL_CHAR_BLOCK = 100
const EL_CREDITS_PER_BLOCK = 2
const EL_MIN_CREDITS = 8
const EL_MAX_CHARS = 2000
const OPENAI_MAX_CHARS = 5000

function calcCreditCost(text: string, voiceId: string): number {
  if (voiceId.startsWith('openai:')) return OPENAI_CREDITS
  return Math.max(EL_MIN_CREDITS, Math.ceil(text.length / EL_CHAR_BLOCK) * EL_CREDITS_PER_BLOCK)
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
    const voiceId = typeof body.voiceId === 'string' ? body.voiceId.trim() : 'openai:nova'

    if (!text || text.length < 3) {
      return NextResponse.json({ error: 'Text is required (min 3 characters)' }, { status: 400 })
    }
    const maxChars = voiceId.startsWith('openai:') ? OPENAI_MAX_CHARS : EL_MAX_CHARS
    if (text.length > maxChars) {
      return NextResponse.json({ error: `Text must be under ${maxChars} characters for this voice` }, { status: 400 })
    }

    const CREDIT_COST = calcCreditCost(text, voiceId)

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
