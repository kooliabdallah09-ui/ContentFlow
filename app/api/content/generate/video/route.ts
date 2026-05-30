import { submitVideoJob as generateVideo } from '@/lib/heygen'
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
    const { script, avatarId = 'avtr_1', voiceId = 'en-US-Neural2-A' } =
      await request.json()

    if (!script || typeof script !== 'string' || script.trim().length === 0) {
      return NextResponse.json(
        { error: 'Script is required and cannot be empty' },
        { status: 400 }
      )
    }

    if (script.length > 3000) {
      return NextResponse.json(
        { error: 'Script exceeds maximum length of 3000 characters' },
        { status: 400 }
      )
    }

    // Calculate credit cost
    const creditCost = CREDIT_COSTS.video

    // Check user credits
    const { data: userCredits, error: creditsError } = await supabase
      .from('user_credits')
      .select('balance')
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

    // Submit HeyGen job (async)
    const result = await generateVideo(script, avatarId, voiceId)

    // Store in database with processing status
    const { error: insertError } = await supabase
      .from('ugc_content')
      .insert({
        user_id: userId,
        content_type: 'video',
        external_id: result.videoId,
        storage_url: null,
        metadata: {
          script: script.substring(0, 500),
          avatarId,
          voiceId,
          characterCount: script.length,
          generatedAt: new Date().toISOString(),
          heygenVideoId: result.videoId,
        },
        credit_cost: creditCost,
        status: 'processing',
      })

    if (insertError) {
      console.error('Database insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to save generated video' },
        { status: 500 }
      )
    }

    // Deduct credits
    const { error: updateError } = await supabase
      .from('user_credits')
      .update({ balance: userCredits.balance - creditCost })
      .eq('user_id', userId)

    if (updateError) {
      console.error('Credit deduction error:', updateError)
      return NextResponse.json(
        { error: 'Failed to deduct credits' },
        { status: 500 }
      )
    }

    // Log transaction
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: creditCost,
      transaction_type: 'generation',
      content_type: 'video',
      description: `Video generation submitted`,
    })

    return NextResponse.json(
      {
        success: true,
        videoId: result.videoId,
        status: 'processing',
        creditDeducted: creditCost,
        newBalance: userCredits.balance - creditCost,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Video generation error:', error)

    if (error instanceof Error) {
      if (error.message.includes('API key not configured')) {
        return NextResponse.json(
          { error: 'Video generation service not configured' },
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
