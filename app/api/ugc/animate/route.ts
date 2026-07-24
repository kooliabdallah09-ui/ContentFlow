import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { deductCredits } from '@/lib/deduct-credits'
import { submitSeedanceJob } from '@/lib/replicate'
import { submitOmniFlashJob } from '@/lib/vertex-video'
import { canAccessOmniFlashVideo } from '@/lib/pov-access'
import { refineProductInFrame, renderCutawayFrame } from '@/lib/nanobanana'
import { planCutaways, cutawayFramePrompt, cutawayMotionPrompt, inferProductCategory, type CutawaySlot } from '@/lib/multi-shot'
import { gridifyWithValidation, GRID_RETRIES, gridify, isSensitivityFlag, attachProductReference } from '@/lib/gridify'
import { buildSeedanceUGCPrompt } from '@/lib/ugc-seedance-prompt'
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
      videoDirection,
      resolution: resolutionRaw,
      engine: engineRaw,
      extraProductImages,
    } = body as Record<string, unknown>
    const extraProductRefs: Array<{ base64: string; mimeType: string }> = Array.isArray(extraProductImages)
      ? extraProductImages
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((r: any) => typeof r?.base64 === 'string' && r.base64.length > 100 && typeof r?.mimeType === 'string')
          .slice(0, 2)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((r: any) => ({ base64: r.base64, mimeType: r.mimeType }))
      : []
    const safeVideoDirection = typeof videoDirection === 'string' ? videoDirection.slice(0, 2000) : undefined
    // Admin-only Gemini Omni Flash (Vertex Veo) alternative to Seedance
    // while BytePlus direct is being provisioned. Non-admins silently fall
    // back to Seedance if they somehow send engine: 'omni-flash'.
    const canUseOmniFlash = canAccessOmniFlashVideo(userData.user?.email)
    const engine: 'seedance-2' | 'seedance-mini' | 'omni-flash' =
      engineRaw === 'omni-flash' && canUseOmniFlash ? 'omni-flash'
      : engineRaw === 'seedance-mini' ? 'seedance-mini'
      : 'seedance-2'
    let resolution: '480p' | '720p' | '1080p' | '4k' =
      resolutionRaw === '480p' || resolutionRaw === '720p' || resolutionRaw === '4k' ? resolutionRaw : '1080p'
    // Mini caps at 720p — clamp both the render and the charge.
    if (engine === 'seedance-mini' && (resolution === '1080p' || resolution === '4k')) resolution = '720p'

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

    // Cost — full UGC package price via the shared pricing module. Includes
    // fixed overhead for the ~5 Nano Banana Pro calls + Claude prompt calls,
    // plus per-second Seedance 2.0 rate at the chosen resolution. Kept in
    // lockstep with the client UGC builder's cost card via lib/ugc-pricing.
    const { ugcPackageCost } = await import('@/lib/ugc-pricing')
    let totalCost = 0
    if (ugcType === 'image-with-voiceover' || ugcType === 'all') totalCost += CREDIT_COSTS.image
    if (ugcType === 'video-with-voiceover' || ugcType === 'all') totalCost += ugcPackageCost(duration, resolution, engine)
    // tier is retained for compatibility with existing callers; not used here.
    void calculateVideoCredits; void tier

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

    // Extract the script's spoken lines + background context (kept for
    // metadata + downstream analytics — Seedance builds its own dialogue
    // from the video-direction prompt below).
    const spokenScript = extractSpokenLines(script)
    const bgMatch = script.match(/\[BACKGROUND:\s*([^\]]+)\]/i)
    const backgroundContext = bgMatch?.[1]?.trim() ?? 'casual indoor setting'
    void spokenScript; void safeCustomInstructions; void avatarGender; void character; void language

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

    // ── Gridify + Seedance 2.0 anchor render ─────────────────────────────
    // 1) Download the picked (or refined) frame.
    // 2) gridifyWithValidation — Claude Haiku eyeballs each candidate grid
    //    and picks the first one where the character stays readable.
    // 3) Upload the winning grid to Supabase Storage → get a public URL.
    // 4) Build the Seedance UGC prompt via Claude Sonnet vision on grid +
    //    product photo, incorporating the user's video-direction note.
    // 5) Submit Seedance. If it flags as sensitive we resubmit with the
    //    next set of grid parameters — up to the retry ladder depth.
    const anchorRes0 = await fetch(animateStartUrl)
    if (!anchorRes0.ok) throw new Error(`Fetch anchor frame failed ${anchorRes0.status}`)
    const anchorSourceBuf = Buffer.from(await anchorRes0.arrayBuffer())

    const initialGrid = await gridifyWithValidation(anchorSourceBuf)
    // Attach the product photo as a visual reference strip (right-side panel
    // on the grid canvas). Seedance sees it as reference-image context; the
    // prompt never mentions it, but the model uses it for packaging fidelity
    // and — for wearables — to know what to put on the character.
    let currentGridBuf = initialGrid.buf
    if (typeof productImageBase64 === 'string' && productImageBase64.length > 100) {
      try {
        const prodBuf = Buffer.from(productImageBase64, 'base64')
        const extraBuf = extraProductRefs[0] ? Buffer.from(extraProductRefs[0].base64, 'base64') : undefined
        currentGridBuf = await attachProductReference(currentGridBuf, prodBuf, extraBuf)
      } catch (err) {
        console.warn('[ugc/animate] attachProductReference failed, using grid-only:', err instanceof Error ? err.message : err)
      }
    }
    let currentGridParams = initialGrid.params
    let currentGridAttemptIdx = GRID_RETRIES.findIndex(p =>
      p.cols === currentGridParams.cols && p.rows === currentGridParams.rows && p.gap === currentGridParams.gap,
    )
    if (currentGridAttemptIdx < 0) currentGridAttemptIdx = 0

    // Upload helper — writes the current grid to Supabase, returns a URL.
    const uploadGrid = async (buf: Buffer): Promise<string> => {
      const stamp = Date.now()
      const filename = `hero-frames/${userId}-${stamp}-grid.png`
      const { error: upErr } = await supabase.storage
        .from('ugc-assets')
        .upload(filename, buf, { contentType: 'image/png', upsert: false })
      if (upErr) throw new Error(`Grid upload failed: ${upErr.message}`)
      const { data: { publicUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
      return publicUrl
    }
    let currentGridUrl = await uploadGrid(currentGridBuf)

    // Persist the raw product photo to storage so the async sensitivity
    // retry (video-status detects E005 mid-render) can re-attach it to a
    // regridified anchor without needing the base64 payload again.
    let productRefUrl: string | undefined
    if (typeof productImageBase64 === 'string' && productImageBase64.length > 100) {
      try {
        const prodFilename = `hero-frames/${userId}-${Date.now()}-productref.jpg`
        const prodJpeg = await sharp(Buffer.from(productImageBase64, 'base64')).jpeg({ quality: 90 }).toBuffer()
        const { error: prodUpErr } = await supabase.storage
          .from('ugc-assets')
          .upload(prodFilename, prodJpeg, { contentType: 'image/jpeg', upsert: false })
        if (!prodUpErr) {
          productRefUrl = supabase.storage.from('ugc-assets').getPublicUrl(prodFilename).data.publicUrl
        }
      } catch (err) {
        console.warn('[ugc/animate] product ref upload failed:', err instanceof Error ? err.message : err)
      }
    }

    // Build the Seedance prompt once (grid + product + user direction).
    const productCategoryForPrompt = typeof productImageBase64 === 'string' && productImageBase64.length > 100
      ? await inferProductCategory({ productName: safeProductName, productDescription: safeProductDescription })
      : undefined

    // Load onboarding context so the UGC-expert AI writes a script that
    // matches the creator's brand tone, audience, niche, and top-scoring
    // format. Fail-soft — an unbrand-ed animate should still work.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let brandContext: any = undefined
    try {
      const [{ data: brand }, { data: intel }, { data: plan }] = await Promise.all([
        supabase.from('brand_profiles').select('company_name, description, product_type, unique_value_prop, target_audience, tone_of_voice, customer_pain_points').eq('user_id', userId).maybeSingle(),
        supabase.from('user_intelligence').select('niche, audience_profile').eq('user_id', userId).maybeSingle(),
        supabase.from('content_plans').select('top_formats').eq('user_id', userId).maybeSingle(),
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topFmt = Array.isArray(plan?.top_formats) && plan!.top_formats.length ? (plan!.top_formats[0] as any).format : undefined
      brandContext = {
        companyName: brand?.company_name ?? undefined,
        productDescription: brand?.description ?? undefined,
        productType: brand?.product_type ?? undefined,
        uniqueValueProp: brand?.unique_value_prop ?? undefined,
        targetAudience: brand?.target_audience ?? undefined,
        toneOfVoice: brand?.tone_of_voice ?? undefined,
        customerPainPoints: brand?.customer_pain_points ?? undefined,
        niche: intel?.niche ?? undefined,
        audienceProfile: intel?.audience_profile && typeof intel.audience_profile === 'object'
          ? JSON.stringify(intel.audience_profile).slice(0, 600)
          : (typeof intel?.audience_profile === 'string' ? intel!.audience_profile : undefined),
        preferredFormat: typeof topFmt === 'string' ? topFmt : undefined,
      }
    } catch (err) {
      console.warn('[ugc/animate] brand context load failed:', err instanceof Error ? err.message : err)
    }

    const seedancePrompt = await buildSeedanceUGCPrompt({
      characterGridBase64: initialGrid.buf.toString('base64'),      // uncomposited grid for Claude vision
      characterGridMimeType: 'image/png',
      productBase64: typeof productImageBase64 === 'string' ? productImageBase64 : undefined,
      productMimeType: typeof productImageMimeType === 'string' ? productImageMimeType : undefined,
      productName: safeProductName,
      productCategory: productCategoryForPrompt,
      videoDirection: safeVideoDirection,
      durationSeconds: duration,
      brandContext,
      extraProductImages: extraProductRefs.length ? extraProductRefs : undefined,
    })

    // Seedance submission with sensitivity retry across the grid ladder.
    // Omni Flash is admin-only and skips the ladder — it goes through Vertex
    // and doesn't share Seedance's E006 / reference-images edge cases.
    let primary: { predictionId: string } | undefined
    let sensitivityRetries: Array<{ attempt: number; error: string }> = []
    if (engine === 'omni-flash') {
      // Fetch the first frame as base64 since Vertex doesn't fetch by URL.
      let startImageBase64: string | undefined
      let startImageMimeType: string | undefined
      try {
        const r = await fetch(currentGridUrl)
        if (r.ok) {
          startImageBase64 = Buffer.from(await r.arrayBuffer()).toString('base64')
          startImageMimeType = r.headers.get('content-type') || 'image/png'
        }
      } catch { /* soft fail — text-only render */ }
      primary = await submitOmniFlashJob({
        prompt: seedancePrompt,
        durationSeconds: Math.min(60, Math.max(3, Number(duration) || 10)),
        aspectRatio: aspect.nanoBananaRatio === '3:4' ? '9:16' : aspect.nanoBananaRatio,
        resolution: resolution === '1080p' ? '1080p' : '720p',
        enableAudio: true,
        startImageBase64,
        startImageMimeType,
      })
    } else {
      for (let i = currentGridAttemptIdx; i < GRID_RETRIES.length; i++) {
        try {
          primary = await submitSeedanceJob({
            prompt: seedancePrompt,
            durationSeconds: Math.min(60, Math.max(3, Number(duration) || 10)),
            aspectRatio: aspect.nanoBananaRatio,
            startImageUrl: currentGridUrl,
            resolution,
            enableAudio: true,
            engine,
          })
          break
        } catch (err) {
          if (!isSensitivityFlag(err) || i === GRID_RETRIES.length - 1) throw err
          sensitivityRetries.push({ attempt: i + 1, error: err instanceof Error ? err.message : 'unknown' })
          // Regridify with the next parameter set and re-upload.
          const nextParams = GRID_RETRIES[i + 1]
          currentGridBuf = await gridify(anchorSourceBuf, nextParams)
          currentGridParams = nextParams
          currentGridUrl = await uploadGrid(currentGridBuf)
        }
      }
    }
    if (!primary) throw new Error(`${engine === 'omni-flash' ? 'Omni Flash' : 'Seedance'} submission failed`)
    // Legacy multi-clip chaining removed — Seedance covers the full duration in one clip.
    const secondary: { predictionId: string } | undefined = undefined
    void secondary

    // Multi-shot cutaway compositing removed — the Seedance 2.0 prompt is
    // now scene-timestamped and produces its own multi-shot output in a
    // single continuous render with continuous native audio. No Shotstack
    // overlay pass needed.
    const cutawayJobs: Array<{
      slot: CutawaySlot
      startAt: number
      duration: number
      predictionId?: string
      startImageUrl?: string
      error?: string
    }> = []
    void planCutaways; void cutawayFramePrompt; void cutawayMotionPrompt; void renderCutawayFrame

    // (Cutaway generation removed — Seedance handles multi-scene natively.)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const components: Record<string, any> = {
      script,
      language: language.code,
      aspect: aspect.id,
      video: {
        videoId: primary.predictionId,
        status: 'processing',
        provider: 'seedance-2',
        duration,
        estimatedDuration: duration,
      },
      cutaways: cutawayJobs.length ? cutawayJobs : undefined,
      multiShot: cutawayJobs.length > 0,
      grid: {
        attempt: currentGridAttemptIdx + 1,
        params: currentGridParams,
        url: currentGridUrl,
        sensitivityRetries: sensitivityRetries.length ? sensitivityRetries : undefined,
      },
      // Everything the async sensitivity-retry endpoint needs to regridify
      // and resubmit if Seedance flags E005 mid-render (after accepting
      // the job — the submit-time ladder can't catch those).
      retryContext: {
        anchorFrameUrl: animateStartUrl,
        productRefUrl,
        prompt: seedancePrompt,
        resolution,
        engine,
        aspectRatio: aspect.nanoBananaRatio,
        durationSeconds: Math.min(60, Math.max(3, Number(duration) || 10)),
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
        multiShot: cutawayJobs.length > 0,
        cutawayCount: cutawayJobs.filter(c => c.predictionId).length,
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
