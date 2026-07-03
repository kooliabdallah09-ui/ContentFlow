import { deductCredits } from '@/lib/deduct-credits'
import { generateNanoBananaImage } from '@/lib/nanobanana'
import { CREDIT_COSTS } from '@/lib/credits'
import sharp from 'sharp'

// Nano Banana 2 takes ~10-12s per image; 4 in parallel can hit 60s on cold start.
export const maxDuration = 120
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
      prompt,
      style = 'realistic',
      size = '1024x1024',
      quantity = 1,
      ratio,
      referenceImageBase64,
      referenceImageMimeType,
    } = await request.json()

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Prompt is required and cannot be empty' },
        { status: 400 }
      )
    }

    // Sanity cap quantity to prevent abuse / cost runaway.
    const safeQuantity = Math.max(1, Math.min(4, Number(quantity) || 1))
    const safeStyle = (['realistic', 'artistic', 'professional', 'minimalist'] as const).includes(style)
      ? (style as 'realistic' | 'artistic' | 'professional' | 'minimalist')
      : 'realistic'
    const safeRatio = (['1:1', '4:5', '9:16', '16:9'] as const).includes(ratio)
      ? (ratio as '1:1' | '4:5' | '9:16' | '16:9')
      : '1:1'

    // If a reference image was uploaded, run it through sharp once to normalize
    // (strip metadata, cap dimensions, re-encode) so Nano Banana sees a sane input.
    let safeRefBase64: string | undefined
    let safeRefMime: string | undefined
    if (typeof referenceImageBase64 === 'string' && typeof referenceImageMimeType === 'string') {
      try {
        const buf = Buffer.from(referenceImageBase64, 'base64')
        if (buf.length > 5 * 1024 * 1024) {
          return NextResponse.json({ error: 'Reference image must be under 5MB' }, { status: 400 })
        }
        const resized = await sharp(buf)
          .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
          .png()
          .toBuffer()
        safeRefBase64 = resized.toString('base64')
        safeRefMime = 'image/png'
      } catch (err) {
        console.warn('[image gen] reference normalize failed, skipping:', err instanceof Error ? err.message : err)
      }
    }

    // Calculate credit cost
    const creditCost = CREDIT_COSTS.image * safeQuantity

    // Check user credits (resilient to missing pack_credits column)
    let userCredits: { balance: number; pack_credits: number } | null = null
    {
      const withPack = await supabase
        .from('user_credits')
        .select('balance, pack_credits')
        .eq('user_id', userId)
        .maybeSingle()
      if (withPack.data) {
        userCredits = { balance: withPack.data.balance ?? 0, pack_credits: withPack.data.pack_credits ?? 0 }
      } else {
        const fallback = await supabase
          .from('user_credits')
          .select('balance')
          .eq('user_id', userId)
          .maybeSingle()
        if (fallback.data) userCredits = { balance: fallback.data.balance ?? 0, pack_credits: 0 }
      }
    }

    if (!userCredits) {
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

    // Generate N images in parallel via Nano Banana 2 (image-to-image when a
    // reference is provided, text-to-image otherwise). Each output is a base64
    // PNG — upload to Supabase Storage so the client gets a real public URL.
    const generationId = `nb-${Date.now()}`
    const generated = await Promise.all(
      Array.from({ length: safeQuantity }).map(() =>
        generateNanoBananaImage(prompt, {
          style: safeStyle,
          ratio: safeRatio,
          referenceImageBase64: safeRefBase64,
          referenceImageMimeType: safeRefMime,
        }),
      ),
    )

    const urls: string[] = []
    for (let i = 0; i < generated.length; i++) {
      const img = generated[i]
      const filename = `image-gen/${userId}-${Date.now()}-${i}.png`
      const buf = Buffer.from(img.imageBase64, 'base64')
      const { error: upErr } = await supabase.storage
        .from('ugc-assets')
        .upload(filename, buf, { contentType: img.mimeType || 'image/png', upsert: false })
      if (upErr) {
        console.error('image upload error:', upErr.message)
        continue
      }
      const { data: { publicUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
      urls.push(publicUrl)
    }

    if (urls.length === 0) {
      return NextResponse.json({ error: 'All image uploads failed' }, { status: 500 })
    }

    // Store one DB row per generation batch — keeps Library clean.
    const { error: insertError } = await supabase.from('ugc_content').insert([{
      user_id: userId,
      content_type: 'image',
      external_id: generationId,
      storage_url: urls[0],
      metadata: {
        prompt,
        style: safeStyle,
        ratio: safeRatio,
        size,
        urls,
        usedReference: !!safeRefBase64,
        model: 'nano-banana-pro',
        generatedAt: new Date().toISOString(),
      },
      credit_cost: creditCost,
      status: 'completed',
    }])
    if (insertError) {
      console.error('Database insert error:', insertError)
    }

    // Deduct credits
    const { newBalance } = await deductCredits(supabase, userId, creditCost, userCredits.balance, userCredits.pack_credits)

    // Log transaction
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: creditCost,
      transaction_type: 'generation',
      content_type: 'image',
      description: `Image generation (${safeQuantity} image${safeQuantity > 1 ? 's' : ''})`,
    })

    return NextResponse.json(
      {
        success: true,
        images: urls,
        generationId,
        creditDeducted: creditCost,
        newBalance,
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
