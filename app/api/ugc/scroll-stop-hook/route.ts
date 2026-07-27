// Scroll-stop hook v1 — admin-gated.
//
// Body: {
//   hookKey, influencerId, productImageBase64, productImageMimeType,
//   extraProductImages, aspectId, sceneId?, formatKey?
// }
//
// Flow:
//   1. Admin gate via lib/pov-access.canAccessScrollStopHook. 403 otherwise.
//   2. Load influencer identity refs (character sheet + portrait + 2 recent
//      photos) — same pattern as /api/ugc/hero-frames. The hook character
//      MUST match the chosen avatar precisely.
//   3. Look up the hook entry in SCROLL_STOP_HOOKS by key.
//   4. Build the first-frame prompt from hook.frame + character identity
//      refs + product ref (only if hook.featuresProduct). Fan out 2 Nano
//      Banana attempts, pick the first that succeeds.
//   5. Upload the frame to ugc-assets/hooks/…
//   6. Submit a Seedance i2v job with hook.motion + hook.sfx. Seedance 2.0's
//      hard minimum is 3s (see lib/replicate.ts submitSeedanceJob), so the
//      hook clip is 3s in v1 even though the design target is 1.5s.
//   7. Deduct SCROLL_STOP_HOOK_COST_CR credits.
//   8. Return { jobId, frameUrl } for the client to poll via video-status.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { generateCharacterWithProduct, generateNanoBananaImage } from '@/lib/nanobanana'
import { submitSeedanceJob } from '@/lib/replicate'
import { deductCredits } from '@/lib/deduct-credits'
import { canAccessScrollStopHook } from '@/lib/pov-access'
import { getScrollStopHook, isHookAllowedForFormat } from '@/lib/scroll-stop-hooks'

export const maxDuration = 180

// Fixed price for v1. Rough raw cost at 720p:
//   - 2 Nano Banana Pro frame attempts  ≈ $0.30
//   - Seedance 2.0 i2v 3s @ 720p         ≈ $0.54  ($0.18/s × 3)
//   raw ≈ $0.84  × 1.8 margin ≈ $1.51    → 63 credits
// We charge 120 cr to leave room for the eventual 1.5s billing when
// Seedance supports sub-3s renders, matching the brief.
export const SCROLL_STOP_HOOK_COST_CR = 120

// Seedance's real hard floor. See lib/replicate.ts:108.
const SEEDANCE_MIN_DURATION_S = 3

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
    const email = userData.user.email

    // Admin gate — v1 is invite-only, non-admin callers get 403.
    if (!canAccessScrollStopHook(email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      hookKey,
      influencerId,
      productImageBase64,
      productImageMimeType,
      extraProductImages,
      aspectId,
      sceneId,
      formatKey,
    } = body as Record<string, unknown>

    const hook = typeof hookKey === 'string' ? getScrollStopHook(hookKey) : undefined
    if (!hook) {
      return NextResponse.json({ error: 'Unknown hookKey' }, { status: 400 })
    }
    if (typeof formatKey === 'string' && !isHookAllowedForFormat(hook, formatKey)) {
      return NextResponse.json({ error: 'Hook not compatible with this format' }, { status: 400 })
    }

    // Credit check up-front. Read + spend under our own row.
    const { data: userCredits, error: credErr } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .maybeSingle()
    if (credErr || !userCredits) {
      return NextResponse.json({ error: 'Credit lookup failed' }, { status: 500 })
    }
    if (userCredits.balance < SCROLL_STOP_HOOK_COST_CR) {
      return NextResponse.json({ error: 'Insufficient credits', required: SCROLL_STOP_HOOK_COST_CR }, { status: 402 })
    }

    const { getAspect } = await import('@/lib/aspects')
    const aspect = getAspect(typeof aspectId === 'string' ? aspectId : undefined)

    // ── Load influencer identity refs — same shape as hero-frames. ──
    let identityRefs: Array<{ base64: string; mimeType: string }> = []
    if (typeof influencerId === 'string' && influencerId.length > 0) {
      try {
        const refUrls: string[] = []
        const [{ data: inf }, { data: pics }] = await Promise.all([
          supabase.from('user_influencers').select('portrait_url, character_sheet_url').eq('id', influencerId).eq('user_id', userId).maybeSingle(),
          supabase.from('user_influencer_photos').select('image_url').eq('influencer_id', influencerId).eq('user_id', userId)
            .order('created_at', { ascending: false }).limit(2),
        ])
        if (inf?.character_sheet_url) refUrls.push(inf.character_sheet_url)
        if (inf?.portrait_url) refUrls.push(inf.portrait_url)
        for (const p of pics ?? []) refUrls.push(p.image_url)
        identityRefs = (await Promise.all(refUrls.slice(0, 3).map(async url => {
          const r = await fetch(url)
          if (!r.ok) return null
          return {
            base64: Buffer.from(await r.arrayBuffer()).toString('base64'),
            mimeType: r.headers.get('content-type') || 'image/png',
          }
        }))).filter((x): x is { base64: string; mimeType: string } => !!x)
      } catch (err) {
        console.warn('[scroll-stop-hook] identity refs load failed:', err instanceof Error ? err.message : err)
      }
    }
    // Optional scene anchor — same pattern as hero-frames.
    let sceneAnchorRef: { base64: string; mimeType: string } | null = null
    if (typeof sceneId === 'string' && sceneId.length > 0) {
      try {
        const { data: sceneRow } = await supabase
          .from('user_scenes')
          .select('hero_image_url, reference_urls')
          .eq('id', sceneId)
          .eq('user_id', userId)
          .maybeSingle()
        const anchorUrl = (Array.isArray(sceneRow?.reference_urls) && (sceneRow?.reference_urls as string[])[0]) || sceneRow?.hero_image_url
        if (typeof anchorUrl === 'string' && anchorUrl.startsWith('http')) {
          const r = await fetch(anchorUrl)
          if (r.ok) {
            sceneAnchorRef = {
              base64: Buffer.from(await r.arrayBuffer()).toString('base64'),
              mimeType: r.headers.get('content-type') || 'image/png',
            }
          }
        }
      } catch { /* soft fail */ }
    }

    const extraProductRefs: Array<{ base64: string; mimeType: string }> = Array.isArray(extraProductImages)
      ? (extraProductImages as unknown[])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((r: any) => typeof r?.base64 === 'string' && r.base64.length > 100 && typeof r?.mimeType === 'string')
          .slice(0, 2)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((r: any) => ({ base64: r.base64, mimeType: r.mimeType }))
      : []

    const hasProduct = !!(productImageBase64 && productImageMimeType)

    // ── Build the frame prompt from the hook definition. ────────────
    const identityBlock = identityRefs.length
      ? 'The person in the reference photos IS the exact character in this shot. Preserve their face, hair, skin tone, and identity precisely — do NOT redesign or restyle.'
      : 'Photorealistic single-subject shot.'
    const framePrompt = `${hook.frame}

${identityBlock}

Framing must fill the entire ${aspect.nanoBananaRatio} frame edge to edge. Hyper-realistic photography, natural lighting consistent with the scene, no text overlays, no watermarks.`

    // Fan out 2 attempts. The hook either works on the first try or it
    // doesn't — no need for a 4-way picker like the main hero frames.
    async function generateOne(): Promise<{ base64: string; mimeType: string }> {
      if (hook!.featuresProduct && hasProduct) {
        const f = await generateCharacterWithProduct(
          productImageBase64 as string,
          productImageMimeType as string,
          'the product',
          framePrompt,
          '',
          undefined,
          aspect.nanoBananaRatio,
          identityRefs[0]?.base64,
          identityRefs[0]?.mimeType,
          extraProductRefs.length ? extraProductRefs : undefined,
        )
        return { base64: f.imageBase64, mimeType: f.mimeType }
      }
      const refs = [...identityRefs]
      if (sceneAnchorRef) refs.push(sceneAnchorRef)
      const f = await generateNanoBananaImage(framePrompt, {
        style: 'realistic',
        ratio: aspect.nanoBananaRatio === '1:1' ? '1:1' : aspect.nanoBananaRatio === '16:9' ? '16:9' : '9:16',
        referenceImages: refs.length ? refs : undefined,
        referenceHint: refs.length
          ? (sceneAnchorRef
              ? 'The FIRST reference image(s) define the exact person — preserve their face, hair, skin tone, and identity precisely. The LAST image is the EXACT scene — match its architecture, materials, decor, palette, and lighting faithfully.'
              : 'The person in the attached reference photo(s) IS this exact character — preserve their face, hair, skin tone, and identity precisely.')
          : undefined,
      })
      return { base64: f.imageBase64, mimeType: f.mimeType }
    }

    const settled = await Promise.allSettled([generateOne(), generateOne()])
    const successes = settled.filter((r): r is PromiseFulfilledResult<{ base64: string; mimeType: string }> => r.status === 'fulfilled')
    if (successes.length === 0) {
      const first = settled.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined
      throw new Error(first?.reason?.message ?? 'Hook frame render failed')
    }

    const { base64 } = successes[0].value
    const resized = await sharp(Buffer.from(base64, 'base64'))
      .resize(aspect.width, aspect.height, { fit: 'cover', position: 'center' })
      .png()
      .toBuffer()
    const filename = `hooks/${userId}-${Date.now()}-${hook.key}.png`
    const { error: upErr } = await supabase.storage.from('ugc-assets').upload(filename, resized, { contentType: 'image/png', upsert: false })
    if (upErr) throw new Error(`Frame upload failed: ${upErr.message}`)
    const { data: pub } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
    const frameUrl = pub.publicUrl

    // ── Submit Seedance. Min 3s (design target 1.5s once available). ──
    const seedancePrompt = `${hook.motion}\n\nNative audio: ${hook.sfx}.`
    const { predictionId } = await submitSeedanceJob({
      prompt: seedancePrompt,
      durationSeconds: SEEDANCE_MIN_DURATION_S,
      aspectRatio: aspect.nanoBananaRatio,
      startImageUrl: frameUrl,
      resolution: '720p',
      enableAudio: true,
      engine: 'seedance-2',
    })

    // Deduct credits AFTER Seedance accepts the job — same ordering as
    // the main animate route (don't burn credits on a submission failure).
    const { newBalance } = await deductCredits(
      supabase,
      userId,
      SCROLL_STOP_HOOK_COST_CR,
      userCredits.balance,
      userCredits.pack_credits,
    )

    return NextResponse.json({
      jobId: predictionId,
      frameUrl,
      hookKey: hook.key,
      durationSec: SEEDANCE_MIN_DURATION_S,
      creditsSpent: SCROLL_STOP_HOOK_COST_CR,
      newBalance,
    })
  } catch (err) {
    console.error('[scroll-stop-hook] failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Hook failed' }, { status: 500 })
  }
}
