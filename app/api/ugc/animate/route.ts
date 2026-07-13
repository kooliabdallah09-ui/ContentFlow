import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { deductCredits } from '@/lib/deduct-credits'
import { submitKlingV3OmniJob } from '@/lib/replicate'
import { buildKlingPrompt } from '@/lib/kling-prompt'
import { refineProductInFrame } from '@/lib/nanobanana'
import { CREDIT_COSTS } from '@/lib/credits'
import {
  DEFAULT_TIER,
  DEFAULT_DURATION,
  DURATION_OPTIONS,
  DURATION_CONFIGS,
  calculateVideoCredits,
  type UGCTier,
  type UGCDuration,
} from '@/lib/tiers'
import { extractSpokenLines } from '@/lib/ugc-script'

export const maxDuration = 300

// UGC pipeline — phase B. The client has already generated hero frames via
// /api/ugc/hero-frames and let the user pick the best one. Here we submit
// Kling v3 omni against that chosen frame, deduct credits, and record the
// generation. Everything downstream (video-status polling, stitch) is
// unchanged from the legacy orchestrate path.
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
      selectedFrameUrl,
      script,
      ugcType = 'video-with-voiceover',
      productName,
      productDescription,
      benefits,
      callToAction,
      avatarGender,
      character: characterFromForm,
      customInstructions,
      language: languageRaw,
      aspect: aspectRaw,
      productImageBase64,
      productImageMimeType,
    } = body as Record<string, unknown>

    if (!selectedFrameUrl || typeof selectedFrameUrl !== 'string' || !selectedFrameUrl.startsWith('http')) {
      return NextResponse.json({ error: 'Missing selectedFrameUrl' }, { status: 400 })
    }
    if (!script || typeof script !== 'string') {
      return NextResponse.json({ error: 'Missing script' }, { status: 400 })
    }

    const { getLanguage } = await import('@/lib/languages')
    const language = getLanguage(typeof languageRaw === 'string' ? languageRaw : undefined)
    const { getAspect } = await import('@/lib/aspects')
    const aspect = getAspect(typeof aspectRaw === 'string' ? aspectRaw : undefined)

    // Duration
    const rawDuration = Number(body.duration ?? DEFAULT_DURATION)
    const allowedDurations: readonly number[] = DURATION_OPTIONS
    const dCfg = allowedDurations.includes(rawDuration) ? DURATION_CONFIGS[rawDuration] : null
    const duration: UGCDuration = dCfg?.available
      ? (rawDuration as UGCDuration)
      : DEFAULT_DURATION
    const durationConfig = DURATION_CONFIGS[duration]

    const tier: UGCTier = DEFAULT_TIER

    // Cost
    let totalCost = 0
    if (ugcType === 'image-with-voiceover' || ugcType === 'all') totalCost += CREDIT_COSTS.image
    if (ugcType === 'video-with-voiceover' || ugcType === 'all') totalCost += calculateVideoCredits(tier, duration)

    const { data: userCredits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .maybeSingle()
    if (!userCredits || userCredits.balance < totalCost) {
      return NextResponse.json({ error: `Insufficient credits. Need ${totalCost}, have ${userCredits?.balance ?? 0}` }, { status: 402 })
    }

    const safeProductName = String(productName || 'the topic').trim() || 'the topic'
    const safeProductDescription = String(productDescription || 'general talking-head content').trim() || 'general talking-head content'
    const safeCustomInstructions = typeof customInstructions === 'string'
      ? customInstructions.slice(0, 1500).trim() || undefined
      : undefined

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const character = characterFromForm as any

    // Kling motion prompt
    const spokenScript = extractSpokenLines(script)
    const bgMatch = script.match(/\[BACKGROUND:\s*([^\]]+)\]/i)
    const backgroundContext = bgMatch?.[1]?.trim() ?? 'casual indoor setting'
    const klingPrompt = await buildKlingPrompt({
      productName: safeProductName,
      productDescription: safeProductDescription,
      scene: backgroundContext,
      script: spokenScript,
      language: language.name,
      customInstructions: safeCustomInstructions,
      gender: (avatarGender === 'Male' || character?.gender === 'Male') ? 'Male' : 'Female',
    })

    // ── Pass 2: product-pixel refinement ─────────────────────────────────
    // If the user uploaded a product photo, run a second Nano Banana pass
    // that composites the EXACT product (label text, logo, colours) into
    // the chosen hero frame. Runs once per package — not per candidate
    // frame — so it's ~$0.03 per generation, not $0.12.
    //
    // Fail-soft: if the refinement errors we fall back to the raw picked
    // frame so the pipeline never blocks.
    let animateStartUrl = selectedFrameUrl
    let refinedFrameUrl: string | undefined
    if (
      typeof productImageBase64 === 'string' && productImageBase64.length > 100 &&
      typeof productImageMimeType === 'string'
    ) {
      try {
        // Download the picked hero frame, run pass 2, upload the result.
        const frameRes = await fetch(selectedFrameUrl)
        if (frameRes.ok) {
          const frameBuf = Buffer.from(await frameRes.arrayBuffer())
          const frameB64 = frameBuf.toString('base64')
          const frameMime = frameRes.headers.get('content-type') || 'image/jpeg'
          const refined = await refineProductInFrame(
            frameB64,
            frameMime,
            productImageBase64,
            productImageMimeType,
            safeProductName,
            aspect.nanoBananaRatio,
          )
          // Resize + JPEG for a smaller upload footprint (Kling doesn't need PNG here).
          const refinedBuf = await sharp(Buffer.from(refined.imageBase64, 'base64'))
            .jpeg({ quality: 92 })
            .toBuffer()
          const stamp = Date.now()
          const filename = `hero-frames/${userId}-${stamp}-refined.jpg`
          const { error: upErr } = await supabase.storage
            .from('ugc-assets')
            .upload(filename, refinedBuf, { contentType: 'image/jpeg', upsert: false })
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
            animateStartUrl = publicUrl
            refinedFrameUrl = publicUrl
          }
        }
      } catch (err) {
        console.warn('[ugc/animate] product refinement failed, using raw frame:', err instanceof Error ? err.message : err)
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    const klingSeconds = durationConfig.klingSeconds
    const clipCount = durationConfig.klingClips

    const primary = await submitKlingV3OmniJob({
      prompt: klingPrompt,
      startImageUrl: animateStartUrl,
      durationSeconds: klingSeconds,
      aspectRatio: aspect.nanoBananaRatio,
    })

    let secondary: { predictionId: string } | undefined
    if (clipCount >= 2) {
      secondary = await submitKlingV3OmniJob({
        prompt: klingPrompt,
        startImageUrl: animateStartUrl,
        durationSeconds: klingSeconds,
        aspectRatio: aspect.nanoBananaRatio,
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const components: Record<string, any> = {
      script,
      language: language.code,
      aspect: aspect.id,
      video: {
        videoId: primary.predictionId,
        status: 'processing',
        provider: 'kling-v3-omni',
        duration,
        estimatedDuration: duration,
        chainedIds: secondary ? [secondary.predictionId] : undefined,
      },
    }

    await supabase.from('ugc_content').insert({
      user_id: userId,
      content_type: 'video',
      external_id: `ugc-${Date.now()}`,
      storage_url: JSON.stringify(components),
      metadata: {
        ugcType,
        productName: safeProductName,
        productDescription: safeProductDescription,
        benefits,
        callToAction,
        script,
        tier,
        selectedFrameUrl,
        refinedFrameUrl,
        productRefined: !!refinedFrameUrl,
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
      description: `UGC package: ${safeProductName} (Kling v3 omni)`,
    })

    return NextResponse.json({
      success: true,
      ugcType,
      components,
      script,
      creditDeducted: totalCost,
      newBalance,
    }, { status: 201 })
  } catch (err) {
    console.error('ugc/animate error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Animate failed' },
      { status: 500 },
    )
  }
}
