import { generateImage } from '@/lib/gemini-image'
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
    const { prompt, style = 'realistic', size = '1024x1024', quantity = 1 } =
      await request.json()

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Prompt is required and cannot be empty' },
        { status: 400 }
      )
    }

    // Calculate credit cost
    const creditCost = CREDIT_COSTS.image * quantity

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

    // Generate image with Gemini
    const result = await generateImage(prompt)
    const generationId = `gemini-${Date.now()}`

    // Store in database
    const upsertData = [{
      user_id: userId,
      content_type: 'image',
      external_id: generationId,
      storage_url: result.imageUrl,
      metadata: {
        prompt,
        style,
        size,
        model: 'gemini-2.0-flash-preview-image-generation',
        generatedAt: new Date().toISOString(),
      },
      credit_cost: CREDIT_COSTS.image,
      status: 'completed',
    }]

    const { error: insertError } = await supabase
      .from('ugc_content')
      .insert(upsertData)

    if (insertError) {
      console.error('Database insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to save generated images' },
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
      content_type: 'image',
      description: `Image generation (${quantity} image${quantity > 1 ? 's' : ''})`,
    })

    return NextResponse.json(
      {
        success: true,
        images: [result.imageUrl],
        generationId,
        creditDeducted: creditCost,
        newBalance: userCredits.balance - creditCost,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Image generation error:', error)

    if (error instanceof Error) {
      if (error.message.includes('API key not configured')) {
        return NextResponse.json(
          { error: 'Image generation service not configured' },
          { status: 500 }
        )
      }
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Generation timeout, please retry' },
          { status: 503 }
        )
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    )
  }
}
