// Crush-Test multi-shot route.
//
// When the user picks the crush-test motion-broll format AND their total
// duration is >8s, we split the video into N distinct crushing-method
// shots (per planCrushTestShots). For each shot we:
//   1. Build a per-method first-frame prompt (Nano Banana Pro) and upload
//      the resulting still to Supabase ugc-assets.
//   2. Submit ONE Seedance job with that frame and the method's motion
//      prompt + native-audio direction, at the per-shot duration.
// All Seedance jobs are fired in parallel. Credits are deducted as the
// SUM of per-shot single-shot costs (ugcPackageCost × N shots — the
// fixed Nano Banana overhead is included per shot since we render a
// dedicated frame per shot). Duration ≤8s falls back to the existing
// single-shot /api/ugc/motion-broll-animate route (this endpoint is only
// invoked for the multi-shot path).
//
// Client polls the returned Seedance jobIds via /api/ugc/video-status?
// provider=seedance-2, then hits /api/ugc/motion-broll-multishot/finalize
// with the ordered videoUrls to concatenate them into one final MP4 via
// Shotstack (reusing submitStitchJob).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { deductCredits } from '@/lib/deduct-credits'
import { submitSeedanceJob } from '@/lib/seedance'
import { generateNanoBananaImage } from '@/lib/nanobanana'
import { getCampaignFormat } from '@/lib/campaign-formats'
import { planCrushTestShots } from '@/lib/multi-shot'
import { ugcPackageCost, type UGCResolution, type UGCEngine } from '@/lib/ugc-pricing'
import { DEFAULT_DURATION, DURATION_OPTIONS, DURATION_CONFIGS, type UGCDuration } from '@/lib/tiers'

export const maxDuration = 300

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
      productName,
      productDescription,
      productImageBase64,
      productImageMimeType,
      extraProductImages,
      formatKey,
      aspect: aspectRaw,
      resolution: resolutionRaw,
      engine: engineRaw,
      videoDirection,
    } = body as Record<string, unknown>

    if (formatKey !== 'crush-test') {
      return NextResponse.json({ error: 'motion-broll-multishot only supports crush-test' }, { status: 400 })
    }
    const fmt = getCampaignFormat('crush-test')
    if (!fmt || fmt.pipeline !== 'motion-broll') {
      return NextResponse.json({ error: 'crush-test format missing' }, { status: 500 })
    }

    const engine: UGCEngine = engineRaw === 'seedance-mini' ? 'seedance-mini' : 'seedance-2'
    let resolution: UGCResolution =
      resolutionRaw === '480p' || resolutionRaw === '720p' || resolutionRaw === '4k' ? resolutionRaw : '1080p'
    if (engine === 'seedance-mini' && (resolution === '1080p' || resolution === '4k')) resolution = '720p'

    const { getAspect } = await import('@/lib/aspects')
    const aspect = getAspect(typeof aspectRaw === 'string' ? aspectRaw : undefined)

    const rawDuration = Number(body.duration ?? body.durationSeconds ?? DEFAULT_DURATION)
    const allowedDurations: readonly number[] = DURATION_OPTIONS
    const dCfg = allowedDurations.includes(rawDuration) ? DURATION_CONFIGS[rawDuration] : null
    const duration: UGCDuration = dCfg?.available ? (rawDuration as UGCDuration) : DEFAULT_DURATION

    if (duration <= 8) {
      return NextResponse.json({ error: 'multishot requires duration >8s — use /api/ugc/motion-broll-animate for single-shot' }, { status: 400 })
    }

    const shots = planCrushTestShots(duration)
    if (shots.length < 2) {
      return NextResponse.json({ error: 'planner returned <2 shots for a multi-shot request' }, { status: 500 })
    }

    // Cost: sum per-shot single-shot cost. Each shot pays its own overhead
    // (dedicated frame render + Seedance job) — this matches the actual
    // provider spend and keeps margin stable.
    const totalCost = shots.reduce((sum, s) => sum + ugcPackageCost(s.durationSec, resolution, engine), 0)

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
    const safeVideoDirection = typeof videoDirection === 'string' ? videoDirection.slice(0, 400).trim() : ''

    const hasProduct = !!(productImageBase64 && productImageMimeType)
    const extraRefs: Array<{ base64: string; mimeType: string }> = Array.isArray(extraProductImages)
      ? (extraProductImages as unknown[])
          .filter((r): r is { base64: string; mimeType: string } =>
            !!r && typeof r === 'object' &&
            typeof (r as { base64?: unknown }).base64 === 'string' &&
            ((r as { base64: string }).base64).length > 100 &&
            typeof (r as { mimeType?: unknown }).mimeType === 'string')
          .slice(0, 2)
          .map(r => ({ base64: r.base64, mimeType: r.mimeType }))
      : []

    const refStack: Array<{ base64: string; mimeType: string }> = []
    if (hasProduct) refStack.push({ base64: productImageBase64 as string, mimeType: productImageMimeType as string })
    for (const r of extraRefs) refStack.push(r)

    // Upload the primary product image once so we can attach it as
    // Seedance reference_images (appearance anchor).
    let productAnchorUrl: string | undefined
    if (hasProduct) {
      try {
        const mt = String(productImageMimeType)
        const ext = mt.includes('jpeg') ? 'jpg' : mt.includes('webp') ? 'webp' : 'png'
        const buf = Buffer.from(String(productImageBase64), 'base64')
        const filename = `motion-broll-ref/${userId}-${Date.now()}-mshot.${ext}`
        const { error: upErr } = await supabase.storage
          .from('ugc-assets')
          .upload(filename, buf, { contentType: mt, upsert: false })
        if (!upErr) {
          productAnchorUrl = supabase.storage.from('ugc-assets').getPublicUrl(filename).data.publicUrl
        }
      } catch (e) {
        console.warn('[motion-broll-multishot] product anchor upload failed:', e instanceof Error ? e.message : e)
      }
    }

    const stamp = Date.now()
    const shotPlan: Array<{
      index: number
      methodKey: string
      durationSec: number
      frameUrl: string
      predictionId: string
    }> = []

    // 1) Generate one first-frame per shot (parallel).
    const framePromises = shots.map(async (shot, i) => {
      const productLine = hasProduct
        ? `Using the attached reference image(s) as the EXACT product — preserve packaging, label text, every logo/font/colour, shape and proportions PIXEL-FAITHFULLY. Do NOT redesign or substitute a generic product.`
        : `Render the product described below as the hero object.`

      const directionBlock = safeVideoDirection
        ? `\n\nDIRECTOR NOTE (fold in where it doesn't conflict): ${safeVideoDirection}`
        : ''

      const prompt = `${productLine}

Generate a hyper-realistic product-first first-frame still for a crush-test motion-broll shot. This frame will be animated forward — compose it as the START of the shot, not the middle.

PRODUCT: ${safeProductName}${safeProductDescription ? ` — ${safeProductDescription.slice(0, 300)}` : ''}

SHOT: ${shot.method.frame}

REALISM ANCHORS:
- Product label + all text must be readable and unstyled — no invented text
- Real, physically-plausible shadow anchoring the product to the surface
- Product is intact and upright at this instant — the crushing has not yet happened
- No motion blur on the product itself (still frame before impact)
- No AI-gloss, no over-sharpening, no commercial-render polish
- No captions, no text overlays, no watermarks

Render in ${aspect.nanoBananaRatio} aspect ratio.${directionBlock}`

      const img = await generateNanoBananaImage(prompt, {
        style: 'professional',
        ratio: aspect.nanoBananaRatio === '1:1' ? '1:1' : aspect.nanoBananaRatio === '16:9' ? '16:9' : '9:16',
        referenceImages: refStack.length ? refStack : undefined,
        referenceHint: refStack.length
          ? `The reference image${refStack.length > 1 ? 's are' : ' is'} the EXACT product — packaging, label, colours, shape must match faithfully.`
          : undefined,
      })

      const resized = await sharp(Buffer.from(img.imageBase64, 'base64'))
        .resize(aspect.width, aspect.height, { fit: 'cover', position: 'center' })
        .png()
        .toBuffer()
      const filename = `kling-source/${userId}-${stamp}-mshot-${i}-${shot.method.key}.png`
      const { error: upErr } = await supabase.storage
        .from('ugc-assets')
        .upload(filename, resized, { contentType: 'image/png', upsert: false })
      if (upErr) throw new Error(`frame upload failed: ${upErr.message}`)
      const frameUrl = supabase.storage.from('ugc-assets').getPublicUrl(filename).data.publicUrl
      return { index: i, shot, frameUrl }
    })

    const framesSettled = await Promise.all(framePromises)

    // 2) Fire one Seedance job per shot in parallel.
    const jobPromises = framesSettled.map(async ({ index, shot, frameUrl }) => {
      const seedancePrompt = `Crush-test motion-broll shot ${index + 1} of ${shots.length}, ${shot.durationSec} seconds, no dialogue, no on-screen text, no watermark. Product stays pixel-faithful to the first frame throughout — same packaging, same label, same colours. ${shot.method.motion} Native audio ON: ${shot.method.audio} No voice, no music.`

      const seedanceBase = {
        prompt: seedancePrompt,
        durationSeconds: Math.min(10, Math.max(3, shot.durationSec)),
        aspectRatio: aspect.nanoBananaRatio,
        startImageUrl: frameUrl,
        resolution,
        enableAudio: true,
        engine: (engine === 'seedance-mini' ? 'seedance-mini' : 'seedance-2') as 'seedance-mini' | 'seedance-2',
      }

      let primary
      try {
        primary = await submitSeedanceJob({
          ...seedanceBase,
          referenceImageUrls: productAnchorUrl ? [productAnchorUrl] : undefined,
        })
      } catch (err) {
        if (productAnchorUrl) {
          console.warn('[motion-broll-multishot] retry without reference_images:', err instanceof Error ? err.message : err)
          primary = await submitSeedanceJob(seedanceBase)
        } else {
          throw err
        }
      }
      return { index, methodKey: shot.method.key, durationSec: shot.durationSec, frameUrl, predictionId: primary.predictionId }
    })

    const jobResults = await Promise.all(jobPromises)
    jobResults.sort((a, b) => a.index - b.index)
    for (const j of jobResults) shotPlan.push(j)

    // Record the package. We use the multiShot flag on the components so
    // the preview knows to wait for all shot Seedance jobs, then trigger
    // the concat finalize step.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const components: Record<string, any> = {
      script: '',
      aspect: aspect.id,
      formatKey: 'crush-test',
      pipeline: 'motion-broll',
      multiShot: true,
      multiShotMode: 'crush-test-concat',
      // Anchor slot points at the FIRST shot so the existing preview
      // polling / status UI has something to bind to. The rest live in
      // crushShots for the concat finalize step.
      video: {
        videoId: shotPlan[0].predictionId,
        status: 'processing',
        provider: 'seedance-2',
        duration,
        estimatedDuration: duration,
      },
      crushShots: shotPlan.map(s => ({
        index: s.index,
        methodKey: s.methodKey,
        predictionId: s.predictionId,
        durationSec: s.durationSec,
        frameUrl: s.frameUrl,
        status: 'processing',
      })),
    }

    await supabase.from('ugc_content').insert({
      user_id: userId,
      content_type: 'video',
      external_id: `ugc-mb-mshot-${Date.now()}`,
      storage_url: JSON.stringify(components),
      metadata: {
        ugcType: 'video-with-voiceover',
        productName: safeProductName,
        productDescription: safeProductDescription,
        pipeline: 'motion-broll',
        formatKey: 'crush-test',
        multiShot: true,
        shotCount: shotPlan.length,
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
      description: `Crush-test multishot ×${shotPlan.length}: ${safeProductName}`,
    })

    return NextResponse.json({
      success: true,
      status: 'processing',
      shotCount: shotPlan.length,
      jobIds: shotPlan.map(s => s.predictionId),
      components,
      creditDeducted: totalCost,
      newBalance,
    }, { status: 201 })
  } catch (err) {
    console.error('ugc/motion-broll-multishot error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Motion-broll multishot failed' },
      { status: 500 },
    )
  }
}
