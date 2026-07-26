import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { generateNanoBananaImage } from '@/lib/nanobanana'
import { getCampaignFormat } from '@/lib/campaign-formats'
import { buildMotionBrollFramePrompt, motionBrollShotDirectionFor } from '@/lib/motion-broll-prompt'

const PACKAGING_FORMATS = new Set(['unboxing-asmr', 'mystery-box'])

export const maxDuration = 180

// Motion-broll first-frame builder. Product-first, no character, no
// dialogue. Composes a hero product still per the format's framing spec
// (aesthetic beauty shot, hands-only ASMR unbox, mystery box, crush test,
// product showcase, hyper-motion). Fans out 4 attempts, uploads them, and
// returns the URLs so the client can pick one and hand it to
// /api/ugc/motion-broll-animate for Seedance.
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
      productPhotoAngles,   // parallel to [primary, ...extras] — angle labels for each product ref
      aspectId,
      formatKey,
      videoDirection,
      sceneId,
    } = body as Record<string, unknown>

    if (typeof formatKey !== 'string' || !formatKey) {
      return NextResponse.json({ error: 'formatKey required' }, { status: 400 })
    }
    const fmt = getCampaignFormat(formatKey)
    if (!fmt || fmt.pipeline !== 'motion-broll') {
      return NextResponse.json({ error: 'formatKey is not a motion-broll format' }, { status: 400 })
    }

    const { getAspect } = await import('@/lib/aspects')
    const aspect = getAspect(typeof aspectId === 'string' ? aspectId : undefined)

    const safeProductName = String(productName || 'the product').trim() || 'the product'
    const safeProductDescription = String(productDescription || '').trim()
    const safeVideoDirection = typeof videoDirection === 'string'
      ? videoDirection.slice(0, 500).trim()
      : ''
    const hasProduct = !!(productImageBase64 && productImageMimeType)

    // Extra product refs (secondary photos) — passed as additional
    // reference stack entries so Nano Banana sees every angle.
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

    // Optional scene anchor — same soft-fail pattern as two-person-frames.
    let sceneAnchorRef: { base64: string; mimeType: string } | null = null
    if (typeof sceneId === 'string' && sceneId.length > 0) {
      try {
        const { data: sceneRow } = await supabase
          .from('user_scenes')
          .select('id, name, scene_prompt, hero_image_url, reference_urls')
          .eq('id', sceneId).eq('user_id', userId).maybeSingle()
        if (sceneRow) {
          const originals: string[] = Array.isArray(sceneRow.reference_urls)
            ? (sceneRow.reference_urls as string[]).filter(u => typeof u === 'string' && u.startsWith('http'))
            : []
          const anchorUrl = originals[0] ?? sceneRow.hero_image_url
          if (typeof anchorUrl === 'string' && anchorUrl.startsWith('http')) {
            try {
              const r = await fetch(anchorUrl)
              if (r.ok) sceneAnchorRef = {
                base64: Buffer.from(await r.arrayBuffer()).toString('base64'),
                mimeType: r.headers.get('content-type') || 'image/png',
              }
            } catch { /* soft */ }
          }
          void supabase.from('user_scenes').update({ last_used_at: new Date().toISOString() })
            .eq('id', sceneId).eq('user_id', userId)
        }
      } catch (err) {
        console.warn('[motion-broll-frames] scene fetch failed:', err instanceof Error ? err.message : err)
      }
    }

    const hasPackagingRef = extraRefs.length > 0
    let imagePrompt = buildMotionBrollFramePrompt({
      formatKey,
      productName: safeProductName,
      productDescription: safeProductDescription,
      videoDirection: safeVideoDirection || undefined,
      aspectRatio: aspect.nanoBananaRatio,
      hasProductRef: hasProduct,
      hasPackagingRef,
    })

    // Hard imperative override — append shot direction at the very end so
    // Nano Banana can't dilute it. Only applies to formats where the
    // composition tends to drift (currently unboxing-asmr / mystery-box).
    if (PACKAGING_FORMATS.has(formatKey)) {
      const direction = motionBrollShotDirectionFor(formatKey, { hasPackagingRef })
      imagePrompt = `${imagePrompt}\n\n=== SHOT COMPOSITION — MANDATORY, OVERRIDES ANYTHING ABOVE ===\n${direction}\n============================================================`
    }

    // Reference stack: primary product → extra product angles → scene anchor.
    const refStack: Array<{ base64: string; mimeType: string }> = []
    if (hasProduct) refStack.push({ base64: productImageBase64 as string, mimeType: productImageMimeType as string })
    for (const r of extraRefs) refStack.push(r)
    if (sceneAnchorRef) refStack.push(sceneAnchorRef)

    const angles: string[] = Array.isArray(productPhotoAngles)
      ? (productPhotoAngles as unknown[]).map(a => typeof a === 'string' ? a.trim() : '')
      : []
    const primaryAngle = angles[0] ?? ''
    const extraAngles = angles.slice(1, 1 + extraRefs.length).filter(Boolean)
    const productHint = hasProduct
      ? `The FIRST reference image is the ${primaryAngle ? `${primaryAngle} view of the` : 'EXACT'} product — packaging, label, colours, shape must match faithfully. ${extraRefs.length ? `The next ${extraRefs.length} image(s) are additional angles / details of the SAME product${extraAngles.length ? ` (${extraAngles.join(', ')})` : ''} — use them to disambiguate shape/label.` : ''}${sceneAnchorRef ? ' The LAST image is the required scene — match its materials, palette, and mood.' : ''}`
      : (sceneAnchorRef ? 'The reference image is the required scene — match its materials, palette, and mood.' : 'Follow the prompt precisely.')

    async function generateOne(): Promise<{ base64: string; mimeType: string }> {
      const f = await generateNanoBananaImage(imagePrompt, {
        style: 'professional',
        ratio: aspect.nanoBananaRatio === '1:1' ? '1:1' : aspect.nanoBananaRatio === '16:9' ? '16:9' : '9:16',
        referenceImages: refStack.length ? refStack : undefined,
        referenceHint: refStack.length ? productHint : undefined,
      })
      return { base64: f.imageBase64, mimeType: f.mimeType }
    }

    const settled = await Promise.allSettled([generateOne(), generateOne(), generateOne(), generateOne()])
    const successes = settled.filter((r): r is PromiseFulfilledResult<{ base64: string; mimeType: string }> => r.status === 'fulfilled')
    if (successes.length === 0) {
      const first = settled.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined
      throw new Error(first?.reason?.message ?? 'All motion-broll frames failed to render')
    }

    const stamp = Date.now()
    const frames: string[] = []
    for (let i = 0; i < successes.length; i++) {
      const { base64 } = successes[i].value
      const resized = await sharp(Buffer.from(base64, 'base64'))
        .resize(aspect.width, aspect.height, { fit: 'cover', position: 'center' })
        .png()
        .toBuffer()
      const filename = `kling-source/${userId}-${stamp}-mb-${i}.png`
      const { error: upErr } = await supabase.storage
        .from('ugc-assets')
        .upload(filename, resized, { contentType: 'image/png', upsert: false })
      if (upErr) continue
      const { data: pub } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
      frames.push(pub.publicUrl)
    }

    if (frames.length === 0) {
      return NextResponse.json({ error: 'Failed to upload any motion-broll frames.' }, { status: 500 })
    }

    return NextResponse.json({ frames, imagePrompt })
  } catch (err) {
    console.error('ugc/motion-broll-frames error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Motion-broll frame generation failed' },
      { status: 500 },
    )
  }
}
