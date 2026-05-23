import { generateImage } from '@/lib/flux-pro'
import { generateVoice } from '@/lib/elevenlabs'
import { generateVideo } from '@/lib/heygen'
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
    const {
      ugcType, // 'video-with-voiceover' | 'image-with-voiceover' | 'all'
      productName,
      productDescription,
      benefits,
      callToAction,
      style = 'realistic',
      imageSize = '1024x1024',
      avatarId = 'avtr_1',
      voiceId = 'en-US-Neural2-A',
    } = await request.json()

    if (!ugcType || !productName || !productDescription || !benefits) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Calculate total credit cost
    let totalCost = 0
    const components: string[] = []

    if (ugcType === 'image-with-voiceover' || ugcType === 'all') {
      totalCost += CREDIT_COSTS.image
      components.push('image')
    }
    if (ugcType === 'video-with-voiceover' || ugcType === 'all') {
      totalCost += CREDIT_COSTS.voice
      components.push('voice')
    }
    if (ugcType === 'all') {
      totalCost += CREDIT_COSTS.video
      components.push('video')
    }

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

    if (userCredits.balance < totalCost) {
      return NextResponse.json(
        {
          error: `Insufficient credits. Need ${totalCost}, have ${userCredits.balance}`,
        },
        { status: 400 }
      )
    }

    // Generate content based on UGC type
    const results: Record<string, any> = { components: {} }

    try {
      // Generate image if needed
      if (ugcType === 'image-with-voiceover' || ugcType === 'all') {
        const imagePrompt = `Product showcase: ${productName}. ${productDescription}. Style: ${style}. Professional product photography style image.`
        const imageResult = await generateImage(imagePrompt, imageSize, 1)
        results.components.image = {
          url: imageResult.imageUrls[0],
          id: imageResult.generationId,
        }
      }

      // Generate voiceover script
      const voiceoverScript = `Hi there! Meet ${productName}. ${productDescription}. With ${benefits}, you'll experience amazing results. ${callToAction}`

      // Generate voice if needed
      if (ugcType === 'video-with-voiceover' || ugcType === 'all') {
        const voiceResult = await generateVoice(
          voiceoverScript,
          voiceId,
          0.5,
          0.75
        )
        results.components.voice = {
          url: voiceResult.audioUrl,
          duration: voiceResult.duration,
        }
      }

      // Generate video if needed
      if (ugcType === 'all') {
        const videoScript = voiceoverScript
        const videoResult = await generateVideo(videoScript, avatarId, voiceId)
        results.components.video = {
          url: videoResult.videoUrl,
          id: videoResult.videoId,
          duration: videoResult.duration,
        }
      }

      // Store UGC package in database
      const { error: insertError } = await supabase
        .from('ugc_content')
        .insert({
          user_id: userId,
          content_type: 'ugc_package',
          external_id: `ugc-${Date.now()}`,
          storage_url: JSON.stringify(results.components),
          metadata: {
            ugcType,
            productName,
            productDescription,
            benefits,
            callToAction,
            components,
            generatedAt: new Date().toISOString(),
          },
          credit_cost: totalCost,
          status: 'completed',
        })

      if (insertError) {
        console.error('Database insert error:', insertError)
        return NextResponse.json(
          { error: 'Failed to save UGC package' },
          { status: 500 }
        )
      }

      // Deduct credits
      const { error: updateError } = await supabase
        .from('user_credits')
        .update({ balance: userCredits.balance - totalCost })
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
        amount: totalCost,
        transaction_type: 'generation',
        content_type: 'ugc_package',
        description: `UGC package generation (${components.join(', ')})`,
      })

      return NextResponse.json(
        {
          success: true,
          ugcType,
          components: results.components,
          creditDeducted: totalCost,
          newBalance: userCredits.balance - totalCost,
        },
        { status: 201 }
      )
    } catch (generationError) {
      console.error('UGC generation error:', generationError)
      throw generationError
    }
  } catch (error) {
    console.error('UGC orchestration error:', error)

    if (error instanceof Error) {
      if (error.message.includes('API key not configured')) {
        return NextResponse.json(
          { error: 'One or more generation services not configured' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    )
  }
}
