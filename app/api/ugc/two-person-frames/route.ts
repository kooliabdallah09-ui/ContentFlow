import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { generateNanoBananaImage } from '@/lib/nanobanana'
import { buildTwoPersonPrompt } from '@/lib/ugc-two-person-prompt'
import { getCampaignFormat } from '@/lib/campaign-formats'

export const maxDuration = 180

// Two-person UGC hero-frame builder. Composes PERSON A (main influencer)
// + PERSON B (either a second saved influencer or an auto-generated
// stranger/friend/partner) into ONE Nano Banana Pro image with format-
// specific staging (street interview, couple sharing, roommate rec).
//
// Fans out 4 attempts, uploads them all, returns public URLs — the
// existing /api/ugc/animate route takes the picked frame from here.
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
      script,
      videoDirection,
      customInstructions,
      aspectId,
      influencerId,          // main (required)
      secondInfluencerId,    // optional second influencer for co-star mode
      sceneId,
      formatKey,
    } = body as Record<string, unknown>

    if (typeof formatKey !== 'string' || !formatKey) {
      return NextResponse.json({ error: 'formatKey required' }, { status: 400 })
    }
    const fmt = getCampaignFormat(formatKey)
    if (!fmt || (fmt.pipeline !== 'ugc-interview' && fmt.pipeline !== 'ugc-couple')) {
      return NextResponse.json({ error: 'formatKey is not a two-person format' }, { status: 400 })
    }
    if (typeof influencerId !== 'string' || !influencerId) {
      return NextResponse.json({ error: 'influencerId required' }, { status: 400 })
    }

    const { getAspect } = await import('@/lib/aspects')
    const aspect = getAspect(typeof aspectId === 'string' ? aspectId : undefined)

    const safeProductName = String(productName || 'the product').trim() || 'the product'
    const safeProductDescription = String(productDescription || '').trim()
    const safeVideoDirection = typeof videoDirection === 'string'
      ? videoDirection.slice(0, 500).trim()
      : (typeof customInstructions === 'string' ? customInstructions.slice(0, 500).trim() : '')
    const hasProduct = !!(productImageBase64 && productImageMimeType)

    // ── Load identity refs for both influencers ───────────────────────
    async function loadInfluencer(infId: string): Promise<{
      description: string
      refs: Array<{ base64: string; mimeType: string }>
    }> {
      const [{ data: inf }, { data: pics }] = await Promise.all([
        supabase.from('user_influencers')
          .select('name, handle, niche, portrait_url, character_sheet_url')
          .eq('id', infId).eq('user_id', userId).maybeSingle(),
        supabase.from('user_influencer_photos').select('image_url')
          .eq('influencer_id', infId).eq('user_id', userId)
          .order('created_at', { ascending: false }).limit(2),
      ])
      const urls: string[] = []
      if (inf?.character_sheet_url) urls.push(inf.character_sheet_url)
      if (inf?.portrait_url) urls.push(inf.portrait_url)
      for (const p of pics ?? []) urls.push(p.image_url)
      const refs = (await Promise.all(urls.slice(0, 3).map(async url => {
        try {
          const r = await fetch(url)
          if (!r.ok) return null
          return {
            base64: Buffer.from(await r.arrayBuffer()).toString('base64'),
            mimeType: r.headers.get('content-type') || 'image/png',
          }
        } catch { return null }
      }))).filter((x): x is { base64: string; mimeType: string } => !!x)
      const bits: string[] = []
      if (inf?.name) bits.push(inf.name as string)
      if (inf?.niche) bits.push(`niche: ${inf.niche as string}`)
      const description = bits.length ? bits.join(' — ') : 'a saved influencer'
      return { description, refs }
    }

    const personA = await loadInfluencer(influencerId)
    if (personA.refs.length === 0) {
      return NextResponse.json({ error: 'Main influencer has no identity photos' }, { status: 400 })
    }

    let personB: { description: string; refs: Array<{ base64: string; mimeType: string }> } | null = null
    if (typeof secondInfluencerId === 'string' && secondInfluencerId.length > 0) {
      personB = await loadInfluencer(secondInfluencerId)
    }

    // ── Optional scene anchor ─────────────────────────────────────────
    let requiredScene: string | null = null
    let sceneAnchorRef: { base64: string; mimeType: string } | null = null
    if (typeof sceneId === 'string' && sceneId.length > 0) {
      try {
        const { data: sceneRow } = await supabase
          .from('user_scenes')
          .select('id, name, scene_prompt, hero_image_url, reference_urls')
          .eq('id', sceneId).eq('user_id', userId).maybeSingle()
        if (sceneRow) {
          requiredScene = `${sceneRow.name} — ${sceneRow.scene_prompt}`.slice(0, 800)
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
        console.warn('[two-person-frames] scene fetch failed:', err instanceof Error ? err.message : err)
      }
    }
    // Format-implied scene if none explicitly picked.
    if (!requiredScene && fmt.requiresScene) {
      requiredScene = `${fmt.label} — ${fmt.sonnetSpec}`.slice(0, 400)
    }

    // ── Build the two-person image prompt ─────────────────────────────
    const scriptText = typeof script === 'string' ? script.slice(0, 2000) : ''
    const { characterIdeaA, characterIdeaB, imagePrompt } = await buildTwoPersonPrompt({
      productName: safeProductName,
      productDescription: safeProductDescription,
      hasProductImage: hasProduct,
      videoDirection: safeVideoDirection || scriptText || undefined,
      formatKey,
      personADescription: personA.description,
      personBDescription: personB?.description,
      requiredScene: requiredScene ?? undefined,
    })

    // ── Compose reference stack: A refs → B refs → scene anchor ──────
    const refStack: Array<{ base64: string; mimeType: string }> = [...personA.refs]
    if (personB) refStack.push(...personB.refs)
    if (hasProduct) refStack.push({ base64: productImageBase64 as string, mimeType: productImageMimeType as string })
    if (sceneAnchorRef) refStack.push(sceneAnchorRef)

    const aCount = personA.refs.length
    const bCount = personB?.refs.length ?? 0
    const productHintLine = hasProduct
      ? ` The reference image AFTER the people images (before any scene image) is the exact product — packaging, label, colours, shape must match faithfully.`
      : ''
    const sceneHintLine = sceneAnchorRef
      ? ' The LAST image is the EXACT scene — architecture, materials, decor, palette, and lighting must match it faithfully.'
      : ''
    const referenceHint = personB
      ? `The FIRST ${aCount} reference image(s) define PERSON A — preserve their face, hair, skin tone, and identity precisely. The NEXT ${bCount} reference image(s) define PERSON B — preserve their face, hair, skin tone, and identity precisely.${productHintLine}${sceneHintLine} Compose both people together in one frame per the prompt.`
      : `The FIRST ${aCount} reference image(s) define PERSON A — preserve their face, hair, skin tone, and identity precisely. PERSON B has no reference photo — invent them faithfully from the text description in the prompt (must look visibly different from PERSON A).${productHintLine}${sceneHintLine}`

    async function generateOne(): Promise<{ base64: string; mimeType: string }> {
      const f = await generateNanoBananaImage(imagePrompt, {
        style: 'realistic',
        ratio: aspect.nanoBananaRatio === '1:1' ? '1:1' : aspect.nanoBananaRatio === '16:9' ? '16:9' : '9:16',
        referenceImages: refStack,
        referenceHint,
      })
      return { base64: f.imageBase64, mimeType: f.mimeType }
    }

    const settled = await Promise.allSettled([generateOne(), generateOne(), generateOne(), generateOne()])
    const successes = settled.filter((r): r is PromiseFulfilledResult<{ base64: string; mimeType: string }> => r.status === 'fulfilled')
    if (successes.length === 0) {
      const first = settled.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined
      throw new Error(first?.reason?.message ?? 'All two-person frames failed to render')
    }

    const stamp = Date.now()
    const frames: string[] = []
    for (let i = 0; i < successes.length; i++) {
      const { base64 } = successes[i].value
      const resized = await sharp(Buffer.from(base64, 'base64'))
        .resize(aspect.width, aspect.height, { fit: 'cover', position: 'center' })
        .png()
        .toBuffer()
      const filename = `kling-source/${userId}-${stamp}-2p-${i}.png`
      const { error: upErr } = await supabase.storage
        .from('ugc-assets')
        .upload(filename, resized, { contentType: 'image/png', upsert: false })
      if (upErr) continue
      const { data: pub } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
      frames.push(pub.publicUrl)
    }

    if (frames.length === 0) {
      return NextResponse.json({ error: 'Failed to upload any two-person frames.' }, { status: 500 })
    }

    return NextResponse.json({
      frames,
      characterIdea: `${characterIdeaA} + ${characterIdeaB}`,
      characterIdeaA,
      characterIdeaB,
      characterImagePrompt: imagePrompt,
      imagePrompt,
    })
  } catch (err) {
    console.error('ugc/two-person-frames error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Two-person frame generation failed' },
      { status: 500 },
    )
  }
}
