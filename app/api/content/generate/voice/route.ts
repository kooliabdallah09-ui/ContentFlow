import { deductCredits } from '@/lib/deduct-credits'
import { generateVoice } from '@/lib/elevenlabs'
import { CREDIT_COSTS } from '@/lib/credits'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Server not configured' },
        { status: 500 }
      )
    }

    // Get and validate auth token
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify user
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = userData.user.id

    // Parse request body
    const { text, voiceId = '21m00Tcm4TlvDq8ikWAM', stability = 0.5, similarityBoost = 0.75 } =
      await request.json()

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text is required and cannot be empty' },
        { status: 400 }
      )
    }

    if (text.length > 5000) {
      return NextResponse.json(
        { error: 'Text exceeds maximum length of 5000 characters' },
        { status: 400 }
      )
    }

    // Calculate credit cost
    const creditCost = CREDIT_COSTS.voice

    // Check user credits
    const { data: userCredits, error: creditsError } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .single()

    if (creditsError || !userCredits) {
      return NextResponse.json(
        { error: 'Could not verify user credits' },
        { status: 500 }
      )
    }

    if (userCredits.balance < creditCost) {
      return NextResponse.json(
        {
          error: `Insufficient credits. Need ${creditCost}, have ${userCredits.balance}`,
        },
        { status: 400 }
      )
    }

    // Generate voice with ElevenLabs
    const result = await generateVoice(text, voiceId, stability, similarityBoost)

    // Store in database
    const { error: insertError } = await supabase
      .from('ugc_content')
      .insert({
        user_id: userId,
        content_type: 'voice',
        external_id: `voice-${Date.now()}`,
        storage_url: result.audioUrl,
        metadata: {
          text: text.substring(0, 500),
          voiceId,
          stability,
          similarityBoost,
          duration: result.duration,
          characterCount: result.characterCount,
          generatedAt: new Date(result.timestamp).toISOString(),
        },
        credit_cost: creditCost,
        status: 'completed',
      })

    if (insertError) {
      console.error('Database insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to save generated voice' },
        { status: 500 }
      )
    }

    // Deduct credits
    const { newBalance } = await deductCredits(supabase, userId, creditCost, userCredits.balance, userCredits.pack_credits)

    // Log transaction
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: creditCost,
      transaction_type: 'generation',
      content_type: 'voice',
      description: `Voice generation (${result.characterCount} characters)`,
    })

    return NextResponse.json(
      {
        success: true,
        audioUrl: result.audioUrl,
        duration: result.duration,
        characterCount: result.characterCount,
        creditDeducted: creditCost,
        newBalance,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Voice generation error:', error)

    if (error instanceof Error) {
      if (error.message.includes('API key not configured')) {
        return NextResponse.json(
          { error: 'Voice generation service not configured' },
          { status: 500 }
        )
      }
      if (error.message.includes('exceeds maximum')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    )
  }
}
