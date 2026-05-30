import { generateImage } from '@/lib/gemini-image'
import { submitVideoJob, estimateDuration } from '@/lib/heygen'
import { CREDIT_COSTS } from '@/lib/credits'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function generateUGCScript(
  productName: string,
  productDescription: string,
  benefits: string,
  callToAction: string,
  productImageBase64?: string,
  productImageMimeType?: string,
): Promise<string> {
  const textPrompt = `Write a 30-second UGC-style video script for a social media ad. Sound like a real person, not a corporate ad. Conversational, energetic, authentic.

Product: ${productName}
Description: ${productDescription}
Benefits: ${benefits}
CTA: ${callToAction}

Rules:
- No stage directions or labels, just the spoken words
- Start with a hook that grabs attention in the first 3 seconds
- Keep it under 80 words
- End with the CTA naturally

Return only the script text.`

  const content: Anthropic.MessageParam['content'] = productImageBase64
    ? [
        { type: 'image', source: { type: 'base64', media_type: productImageMimeType as 'image/jpeg' | 'image/png' | 'image/webp', data: productImageBase64 } },
        { type: 'text', text: textPrompt },
      ]
    : textPrompt

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content }],
  })

  return (msg.content[0] as { text: string }).text.trim()
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.slice(7))
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = userData.user.id
    const { ugcType, productName, productDescription, benefits, callToAction, style = 'realistic', imageSize = '1024x1024', avatarId, voiceId, productImageBase64, productImageMimeType } = await request.json()

    if (!ugcType || !productName || !productDescription || !benefits) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Calculate credit cost
    let totalCost = 0
    if (ugcType === 'image-with-voiceover' || ugcType === 'all') totalCost += CREDIT_COSTS.image
    if (ugcType === 'video-with-voiceover' || ugcType === 'all') totalCost += CREDIT_COSTS.video
    if (ugcType === 'all') totalCost += CREDIT_COSTS.video

    const { data: userCredits } = await supabase.from('user_credits').select('balance').eq('user_id', userId).single()
    if (!userCredits || userCredits.balance < totalCost) {
      return NextResponse.json({ error: `Insufficient credits. Need ${totalCost}, have ${userCredits?.balance ?? 0}` }, { status: 400 })
    }

    // Generate Claude script first
    const script = await generateUGCScript(productName, productDescription, benefits, callToAction || 'Try it today', productImageBase64, productImageMimeType)

    const components: Record<string, any> = { script }

    // Generate image if needed
    if (ugcType === 'image-with-voiceover' || ugcType === 'all') {
      const imageResult = await generateImage(
        `Professional product showcase photo of ${productName}. ${productDescription}. Style: ${style}. Clean background, studio lighting, commercial quality.`,
        productImageBase64,
        productImageMimeType,
      )
      components.image = { url: imageResult.imageUrl, id: `gemini-${Date.now()}` }
    }

    // Submit HeyGen job (async — returns immediately with videoId)
    if (ugcType === 'video-with-voiceover' || ugcType === 'all') {
      if (!avatarId) {
        return NextResponse.json({ error: 'Avatar required for video generation' }, { status: 400 })
      }
      const { videoId } = await submitVideoJob(script, avatarId, voiceId)
      components.video = {
        videoId,
        status: 'processing',
        estimatedDuration: estimateDuration(script),
      }
    }

    // Map to allowed content_type values ('image' | 'video' | 'voice')
    const dbContentType = (ugcType === 'image-with-voiceover') ? 'image' : 'video'

    // Save to DB
    const { error: insertError } = await supabase.from('ugc_content').insert({
      user_id: userId,
      content_type: dbContentType,
      external_id: `ugc-${Date.now()}`,
      storage_url: JSON.stringify(components),
      metadata: { ugcType, productName, productDescription, benefits, callToAction, script, generatedAt: new Date().toISOString() },
      credit_cost: totalCost,
      status: 'completed',
    })

    if (insertError) {
      console.error('DB insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save UGC package' }, { status: 500 })
    }

    // Deduct credits
    await supabase.from('user_credits').update({ balance: userCredits.balance - totalCost }).eq('user_id', userId)
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: totalCost,
      transaction_type: 'generation',
      content_type: 'ugc_package',
      description: `UGC package: ${productName}`,
    })

    return NextResponse.json({
      success: true,
      ugcType,
      components,
      script,
      creditDeducted: totalCost,
      newBalance: userCredits.balance - totalCost,
    }, { status: 201 })

  } catch (error) {
    console.error('UGC orchestration error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Generation failed' }, { status: 500 })
  }
}
