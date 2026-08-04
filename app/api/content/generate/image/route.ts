import { deductCredits } from '@/lib/deduct-credits'
import { generateNanoBananaImage } from '@/lib/nanobanana'
import { CREDIT_COSTS } from '@/lib/credits'
import sharp from 'sharp'

// Nano Banana 2 takes ~10-12s per image; 4 in parallel can hit 60s on cold start.
export const maxDuration = 120
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// History for the persistent gallery: every image URL this user has
// generated here, newest first (batch rows flattened via metadata.urls).
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase
      .from('ugc_content')
      .select('storage_url, metadata, created_at')
      .eq('user_id', userData.user.id)
      .eq('content_type', 'image')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(60)

    const images = (data ?? []).flatMap(row => {
      const meta = (row.metadata ?? {}) as { urls?: string[]; prompt?: string }
      const urls = Array.isArray(meta.urls) && meta.urls.length ? meta.urls : [row.storage_url]
      return urls
        .filter((u): u is string => typeof u === 'string' && u.startsWith('http'))
        .map(url => ({ url, prompt: meta.prompt ?? '', created_at: row.created_at }))
    })
    return NextResponse.json({ images })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { url } = await request.json()
    if (typeof url !== 'string') return NextResponse.json({ error: 'Missing url' }, { status: 400 })
    await supabase.from('ugc_content')
      .delete()
      .eq('user_id', userData.user.id)
      .eq('content_type', 'image')
      .eq('storage_url', url)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

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
      model: modelRaw,
      resolution: resolutionRaw,
      influencerId,
      studioProductId,
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
    const model: 'pro' | 'nb2' = modelRaw === 'nb2' ? 'nb2' : 'pro'
    const resolution: '2K' | '4K' = resolutionRaw === '4K' && model === 'pro' ? '4K' : '2K'
    const rawMode = style === 'raw'
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
        if (buf.length > 20 * 1024 * 1024) {
          return NextResponse.json({ error: 'Reference image must be under 20MB' }, { status: 400 })
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

    // Per-image pricing: NB2 5cr · Pro 2K 10cr · Pro 4K 18cr (1.8× markup
    // on $0.075 / $0.139 / $0.24 raw).
    const perImage = model === 'nb2' ? CREDIT_COSTS.image : resolution === '4K' ? 18 : 10
    const creditCost = perImage * safeQuantity

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

    // Optional feature refs: an AI influencer (identity) and/or a Product
    // Studio product (exact packaging).
    const featureRefs: Array<{ base64: string; mimeType: string }> = []
    let identityCount = 0
    let featureHint = ''
    let promptPrefix = ''
    const fetchRef = async (url: string) => {
      try {
        const r = await fetch(url)
        if (!r.ok) return null
        return { base64: Buffer.from(await r.arrayBuffer()).toString('base64'), mimeType: r.headers.get('content-type') || 'image/png' }
      } catch { return null }
    }
    if (typeof influencerId === 'string' && influencerId.length > 0) {
      const { data: inf } = await supabase
        .from('user_influencers')
        .select('appearance_prompt, portrait_url, character_sheet_url')
        .eq('id', influencerId).eq('user_id', userId).maybeSingle()
      if (inf) {
        for (const u of [inf.character_sheet_url, inf.portrait_url]) {
          if (typeof u === 'string' && u.startsWith('http')) {
            const ref = await fetchRef(u)
            if (ref) { featureRefs.push(ref); identityCount++ }
          }
        }
        promptPrefix += `${inf.appearance_prompt}\n\nThe person appears candidly in the visual — mid-action, natural face, no plastic face, no AI-smooth skin, not posing at the camera, not necessarily centered.\n\n`
      }
    }
    if (typeof studioProductId === 'string' && studioProductId.length > 0) {
      const { data: prod } = await supabase
        .from('user_studio_products')
        .select('name, photo_urls')
        .eq('id', studioProductId).eq('user_id', userId).maybeSingle()
      if (prod) {
        const urls: string[] = Array.isArray(prod.photo_urls) ? prod.photo_urls.slice(0, 2) : []
        for (const u of urls) {
          const ref = await fetchRef(u)
          if (ref) featureRefs.push(ref)
        }
        promptPrefix += `The product "${prod.name}" is featured prominently in the visual.\n\n`
      }
    }
    if (featureRefs.length) {
      featureHint = identityCount > 0
        ? `The FIRST ${identityCount} reference image(s) define an exact person — face, hair, skin tone, build ONLY; clothing may change per the prompt.${featureRefs.length > identityCount ? ' The remaining image(s) show the EXACT product — preserve its packaging, label text, colours, shape and proportions perfectly; never redesign it.' : ''} Apply the prompt as scene + styling around them.`
        : 'The attached reference photos show the EXACT product (multiple angles of the same item) — preserve its packaging, label text, colours, shape and proportions perfectly; never redesign it. Apply the prompt as the scene and styling around it.'
    }

    // Generate N images in batches of 2 to avoid hitting Vertex rate limits.
    // Promise.allSettled so a single failure doesn't kill the whole batch.
    const generationId = `nb-${Date.now()}`
    const imagePrompt = promptPrefix ? `${promptPrefix}${prompt}` : prompt
    const imageOpts = {
      style: safeStyle,
      ratio: safeRatio,
      model,
      resolution: model === 'pro' ? resolution : undefined,
      raw: rawMode,
      referenceImages: featureRefs.length ? featureRefs : undefined,
      referenceHint: featureHint || undefined,
      referenceImageBase64: featureRefs.length ? undefined : safeRefBase64,
      referenceImageMimeType: featureRefs.length ? undefined : safeRefMime,
    }
    const settled: PromiseSettledResult<Awaited<ReturnType<typeof generateNanoBananaImage>>>[] = []
    for (let i = 0; i < safeQuantity; i += 2) {
      if (i > 0) await new Promise(r => setTimeout(r, 600))
      const batch = Array.from({ length: Math.min(2, safeQuantity - i) }, () => generateNanoBananaImage(imagePrompt, imageOpts))
      settled.push(...await Promise.allSettled(batch))
    }
    const generated = settled.flatMap(r => r.status === 'fulfilled' ? [r.value] : [])

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
