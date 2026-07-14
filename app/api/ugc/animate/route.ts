import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { deductCredits } from '@/lib/deduct-credits'
import { submitSeedanceJob } from '@/lib/replicate'
import { refineProductInFrame, renderCutawayFrame } from '@/lib/nanobanana'
import { planCutaways, cutawayFramePrompt, cutawayMotionPrompt, inferProductCategory, type CutawaySlot } from '@/lib/multi-shot'
import { gridifyWithValidation, GRID_RETRIES, gridify, isSensitivityFlag } from '@/lib/gridify'
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
      multiShot: multiShotRaw,
      videoDirection,
    } = body as Record<string, unknown>
    const multiShot = multiShotRaw !== false  // default on
    const safeVideoDirection = typeof videoDirection === 'string' ? videoDirection.slice(0, 2000) : undefined

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
    let currentGridBuf = initialGrid.buf
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

    // Build the Seedance prompt once (grid + product + user direction).
    const seedancePrompt = await buildSeedanceUGCPrompt({
      characterGridBase64: currentGridBuf.toString('base64'),
      characterGridMimeType: 'image/png',
      productBase64: typeof productImageBase64 === 'string' ? productImageBase64 : undefined,
      productMimeType: typeof productImageMimeType === 'string' ? productImageMimeType : undefined,
      productName: safeProductName,
      videoDirection: safeVideoDirection,
    })

    // Seedance submission with sensitivity retry across the grid ladder.
    let primary: { predictionId: string } | undefined
    let sensitivityRetries: Array<{ attempt: number; error: string }> = []
    for (let i = currentGridAttemptIdx; i < GRID_RETRIES.length; i++) {
      try {
        primary = await submitSeedanceJob({
          prompt: seedancePrompt,
          durationSeconds: Math.min(60, Math.max(3, Number(duration) || 10)),
          aspectRatio: aspect.nanoBananaRatio,
          startImageUrl: currentGridUrl,
          resolution: '1080p',
          enableAudio: true,
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
    if (!primary) throw new Error('Seedance submission failed across every grid retry')
    // Legacy multi-clip chaining removed — Seedance covers the full duration in one clip.
    const secondary: { predictionId: string } | undefined = undefined
    void secondary

    // ── Multi-shot cutaways ──────────────────────────────────────────────
    // Kick off silent Seedance 2.0 b-roll cutaways in parallel with the
    // Kling anchor. Each cutaway is 2s of image-to-video seeded by a
    // Nano Banana render that uses the refined anchor frame + product
    // photo as image_input so the character stays consistent.
    //
    // Fail-soft: if any cutaway errors we save what we have and the
    // downstream composite will just skip the missing slot.
    const cutawayPlan = multiShot ? planCutaways(duration) : { count: 0, cutawayDuration: 0, positions: [], slots: [] as CutawaySlot[] }
    const cutawayJobs: Array<{
      slot: CutawaySlot
      startAt: number
      duration: number
      predictionId?: string
      startImageUrl?: string
      error?: string
    }> = []

    if (cutawayPlan.count > 0 && typeof productImageBase64 === 'string' && productImageBase64.length > 100 && typeof productImageMimeType === 'string') {
      try {
        // Download the animate start frame (refined if pass-2 ran, else the picked frame).
        const anchorRes = await fetch(animateStartUrl)
        if (anchorRes.ok) {
          const anchorBuf = Buffer.from(await anchorRes.arrayBuffer())
          const anchorB64 = anchorBuf.toString('base64')
          const anchorMime = anchorRes.headers.get('content-type') || 'image/jpeg'

          // Classify the product once so every cutaway slot pulls the right
          // real-world action + camera angle (skincare -> mirror + propped
          // phone; drink -> kitchen counter + sip; app -> laptop OTS; etc.)
          const productCategory = await inferProductCategory({
            productName: safeProductName,
            productDescription: safeProductDescription,
          })

          const settled = await Promise.allSettled(
            cutawayPlan.slots.map(async (slot, idx) => {
              // 1. Nano Banana frame for this slot — product-category aware
              const framePrompt = cutawayFramePrompt(slot, safeProductName, backgroundContext, productCategory)
              const cf = await renderCutawayFrame(
                anchorB64, anchorMime,
                productImageBase64 as string, productImageMimeType as string,
                framePrompt, aspect.nanoBananaRatio,
              )
              // 2. Upload the cutaway frame
              const cutawayBuf = await sharp(Buffer.from(cf.imageBase64, 'base64'))
                .jpeg({ quality: 90 })
                .toBuffer()
              const stamp = Date.now()
              const filename = `hero-frames/${userId}-${stamp}-cutaway-${idx}-${slot}.jpg`
              const { error: upErr } = await supabase.storage
                .from('ugc-assets')
                .upload(filename, cutawayBuf, { contentType: 'image/jpeg', upsert: false })
              if (upErr) throw new Error(`Cutaway frame upload: ${upErr.message}`)
              const { data: { publicUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
              // 3. Kick off silent Seedance — same category so motion matches framing
              const motion = cutawayMotionPrompt(slot, safeProductName, productCategory)
              const job = await submitSeedanceJob({
                prompt: motion,
                durationSeconds: cutawayPlan.cutawayDuration,
                aspectRatio: aspect.nanoBananaRatio,
                startImageUrl: publicUrl,
                resolution: '720p',
                enableAudio: false,
              })
              return { slot, predictionId: job.predictionId, startImageUrl: publicUrl }
            }),
          )
          settled.forEach((r, i) => {
            if (r.status === 'fulfilled') {
              cutawayJobs.push({
                ...r.value,
                startAt: cutawayPlan.positions[i],
                duration: cutawayPlan.cutawayDuration,
              })
            } else {
              cutawayJobs.push({
                slot: cutawayPlan.slots[i],
                startAt: cutawayPlan.positions[i],
                duration: cutawayPlan.cutawayDuration,
                error: r.reason instanceof Error ? r.reason.message : 'unknown',
              })
            }
          })
        }
      } catch (err) {
        console.warn('[ugc/animate] cutaway generation failed, falling back to single-shot:', err instanceof Error ? err.message : err)
      }
    }
    // ─────────────────────────────────────────────────────────────────────

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
