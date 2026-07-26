import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { deductCredits } from '@/lib/deduct-credits'
import { submitSeedanceJob } from '@/lib/replicate'
import { getCampaignFormat } from '@/lib/campaign-formats'
import { buildMotionBrollSeedancePrompt } from '@/lib/motion-broll-prompt'
import { ugcPackageCost, type UGCResolution, type UGCEngine } from '@/lib/ugc-pricing'
import {
  DEFAULT_DURATION,
  DURATION_OPTIONS,
  DURATION_CONFIGS,
  type UGCDuration,
} from '@/lib/tiers'

export const maxDuration = 60

// Motion-broll animate step. Takes the user-picked product-hero first
// frame and submits Seedance with a per-format motion prompt — no
// character direction, no dialogue. Credits deducted via the shared
// ugcPackageCost formula so cost parity with /api/ugc/animate is exact.
export async function POST(request: NextRequest) {
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
    const userId = userData.user.id

    const body = await request.json()
    const {
      frameUrl,
      selectedFrameUrl,
      formatKey,
      productName,
      productDescription,
      videoDirection,
      aspect: aspectRaw,
      resolution: resolutionRaw,
      engine: engineRaw,
      productImageUrl: productImageUrlRaw,
      productImageBase64,
      productImageMimeType,
    } = body as Record<string, unknown>

    const startUrl = typeof frameUrl === 'string' && frameUrl.startsWith('http')
      ? frameUrl
      : (typeof selectedFrameUrl === 'string' && selectedFrameUrl.startsWith('http') ? selectedFrameUrl : null)
    if (!startUrl) {
      return NextResponse.json({ error: 'Missing frameUrl' }, { status: 400 })
    }
    if (typeof formatKey !== 'string' || !formatKey) {
      return NextResponse.json({ error: 'formatKey required' }, { status: 400 })
    }
    const fmt = getCampaignFormat(formatKey)
    if (!fmt || fmt.pipeline !== 'motion-broll') {
      return NextResponse.json({ error: 'formatKey is not a motion-broll format' }, { status: 400 })
    }

    // Engine + resolution — same clamps as /api/ugc/animate. Omni-flash is
    // admin-only and out of scope for motion-broll; we accept only
    // Seedance variants here.
    const engine: UGCEngine = engineRaw === 'seedance-mini' ? 'seedance-mini' : 'seedance-2'
    let resolution: UGCResolution =
      resolutionRaw === '480p' || resolutionRaw === '720p' || resolutionRaw === '4k' ? resolutionRaw : '1080p'
    if (engine === 'seedance-mini' && (resolution === '1080p' || resolution === '4k')) resolution = '720p'

    const { getAspect } = await import('@/lib/aspects')
    const aspect = getAspect(typeof aspectRaw === 'string' ? aspectRaw : undefined)

    // Duration.
    const rawDuration = Number(body.duration ?? body.durationSeconds ?? DEFAULT_DURATION)
    const allowedDurations: readonly number[] = DURATION_OPTIONS
    const dCfg = allowedDurations.includes(rawDuration) ? DURATION_CONFIGS[rawDuration] : null
    const duration: UGCDuration = dCfg?.available ? (rawDuration as UGCDuration) : DEFAULT_DURATION

    // Cost — full package price (Nano Banana overhead already paid at
    // frames step is included in the fixed overhead component). Kept in
    // parity with /api/ugc/animate so credit UX doesn't drift by format.
    const totalCost = ugcPackageCost(duration, resolution, engine)

    const { data: userCredits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .maybeSingle()
    if (!userCredits || userCredits.balance < totalCost) {
      return NextResponse.json({ error: `Insufficient credits. Need ${totalCost}, have ${userCredits?.balance ?? 0}` }, { status: 402 })
    }

    const safeProductName = String(productName || 'the product').trim() || 'the product'
    const safeProductDescription = String(productDescription || '').trim()
    const safeVideoDirection = typeof videoDirection === 'string' ? videoDirection.slice(0, 500).trim() : ''
    void safeProductDescription

    const seedancePrompt = buildMotionBrollSeedancePrompt({
      formatKey,
      productName: safeProductName,
      durationSeconds: duration,
      videoDirection: safeVideoDirection || undefined,
    })

    // Product appearance anchor — gives Seedance the real product to bind
    // to. Especially matters for unboxing / mystery-box where the first
    // frame hides the product inside a box. Upload the base64 to storage
    // so we can hand Seedance a public URL. Fail-soft.
    let productAnchorUrl: string | undefined = typeof productImageUrlRaw === 'string' && productImageUrlRaw.startsWith('http')
      ? productImageUrlRaw
      : undefined
    if (!productAnchorUrl && typeof productImageBase64 === 'string' && productImageBase64.length > 100) {
      try {
        const mt = typeof productImageMimeType === 'string' ? productImageMimeType : 'image/png'
        const ext = mt.includes('jpeg') ? 'jpg' : mt.includes('webp') ? 'webp' : 'png'
        const buf = Buffer.from(productImageBase64, 'base64')
        const filename = `motion-broll-ref/${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('ugc-assets')
          .upload(filename, buf, { contentType: mt, upsert: false })
        if (!upErr) {
          productAnchorUrl = supabase.storage.from('ugc-assets').getPublicUrl(filename).data.publicUrl
        }
      } catch (e) {
        console.warn('[motion-broll-animate] product anchor upload failed:', e instanceof Error ? e.message : e)
      }
    }

    const seedanceBase = {
      prompt: seedancePrompt,
      durationSeconds: Math.min(60, Math.max(3, Number(duration) || 10)),
      aspectRatio: aspect.nanoBananaRatio,
      startImageUrl: startUrl,
      resolution,
      enableAudio: true,
      engine: (engine === 'seedance-mini' ? 'seedance-mini' : 'seedance-2') as 'seedance-mini' | 'seedance-2',
    }

    // Try with reference_images as an appearance anchor. Seedance can
    // reject reference_images + first frame together (E006) — in that
    // case retry with the first frame only. The strengthened frame spec
    // still gives it usable product visibility.
    let primary
    try {
      primary = await submitSeedanceJob({
        ...seedanceBase,
        referenceImageUrls: productAnchorUrl ? [productAnchorUrl] : undefined,
      })
    } catch (err) {
      if (productAnchorUrl) {
        console.warn('[motion-broll-animate] retry without reference_images:', err instanceof Error ? err.message : err)
        primary = await submitSeedanceJob(seedanceBase)
      } else {
        throw err
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const components: Record<string, any> = {
      script: '',            // motion-broll has no dialogue
      aspect: aspect.id,
      formatKey,
      pipeline: 'motion-broll',
      video: {
        videoId: primary.predictionId,
        status: 'processing',
        provider: 'seedance-2',
        duration,
        estimatedDuration: duration,
      },
      motionBrollPrompt: seedancePrompt,
    }

    await supabase.from('ugc_content').insert({
      user_id: userId,
      content_type: 'video',
      external_id: `ugc-mb-${Date.now()}`,
      storage_url: JSON.stringify(components),
      metadata: {
        ugcType: 'video-with-voiceover',
        productName: safeProductName,
        productDescription: safeProductDescription,
        pipeline: 'motion-broll',
        formatKey,
        selectedFrameUrl: startUrl,
        generatedAt: new Date().toISOString(),
      },
      credit_cost: totalCost,
      status: 'generating',
    })

    const { newBalance } = await deductCredits(supabase, userId, totalCost, userCredits.balance, userCredits.pack_credits)
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: totalCost,
      transaction_type: 'generation',
      content_type: 'ugc_package',
      description: `Motion-broll: ${safeProductName} (${fmt.label})`,
    })

    return NextResponse.json({
      success: true,
      jobId: primary.predictionId,
      status: 'processing',
      components,
      creditDeducted: totalCost,
      newBalance,
    }, { status: 201 })
  } catch (err) {
    console.error('ugc/motion-broll-animate error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Motion-broll animate failed' },
      { status: 500 },
    )
  }
}
