// Product Studio photoshoot — aesthetic product photos with AI-directed
// concepts.
//
// POST { direction?, count, ratio, quality } —
//   1. Sonnet invents `count` DISTINCT shot concepts for this product
//      (editorial food/product photography energy: stacked hero, splash,
//      pour, spread, macro texture…), avoiding the concepts used in the
//      product's recent shoots so repeat batches stay fresh. If the user
//      typed a direction, every concept builds on it (still AI-processed).
//   2. Nano Banana renders each concept with the product's reference
//      angles as fidelity anchors.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { generateNanoBananaImage } from '@/lib/nanobanana'
import { deductCredits } from '@/lib/deduct-credits'

export const maxDuration = 180

// Studio tiers at 1.4× markup: NB2 $0.075 · Pro 2K $0.139 · Pro 4K $0.24 raw.
const CR = { nb2: 4, pro: 8, '4k': 14 } as const

const AD_CONCEPT_SYSTEM = `You are a senior brand designer for scroll-stopping social ads. Think Nike, Aime Leon Dore, Fenty, Liquid Death, Poppi, Recess — bold display typography, confident colour, editorial art-direction. Copy is short, punchy, campaign-ready.

Every batch must sample from THREE styles (mix them, never all the same):
  A. BOLD TYPOGRAPHIC — massive display headline dominates, saturated single-colour or duotone background, product as a clean cut-out, star bar or "SHOP NOW" pill optional. Editorial promo poster energy (Early Bird Sale / 20% OFF / Happy Kids / New Arrival).
  B. AESTHETIC EDITORIAL TYPE — sophisticated magazine-cover feel: elegant serif or condensed sans headline layered over a real styled scene (product on stone, on silk, in water, in nature), muted palette, generous negative space, small tagline in a corner, subtle brand mark. Think Vogue / Kinfolk / Aesop.
  C. LOGO / MINIMAL BRAND — the product plus its LOGO OR WORDMARK is the whole composition. Monochrome or two-tone. Might be a rotated tag, a stamped mark, a repeating word pattern, or a huge single letter behind the product. Very restrained, very confident.

Given a product sheet, invent shot CONCEPTS for a batch of ads. Return ONLY valid JSON:
{"shots": [{"concept": "3-6 word label — Bold Typographic / Aesthetic Editorial / Logo Minimal — descriptor", "prompt": "one dense sentence: (a) the exact HEADLINE COPY in quotes (≤8 words, spellable, product-appropriate, in the brand's likely voice), (b) any smaller sub-copy in quotes, (c) exact palette (background colour + accent colour, e.g. 'saffron background, ink-black type, one crimson word'), (d) typography vibe (ultra-bold condensed sans / elegant italic serif / hand-scrawled / stencil), (e) product placement (off-centre bottom right, floating dead-centre, cut-out overlapping the headline, tucked behind a giant letter…), (f) any composition tricks (diagonal stripes with #SALE repeat, star bar, small green SHOP NOW pill, corner price tag, embossed logo watermark)."}]}

Rules:
- Every shot in the batch must be a DIFFERENT style/format. Mix A, B, C — never all three the same.
- NEVER reuse any concept from the AVOID list.
- Copy must fit the product category, sound like a real modern brand (not stock phrases), and be spellable — no gibberish, no lorem ipsum, no made-up words.
- Never describe the product's own appearance — the image model receives its actual photos separately and must preserve packaging, labels and colours exactly.`

const CONCEPT_SYSTEM = `You are an award-winning product photographer and art director shooting campaigns for the world's best DTC and heritage brands — Aesop, Fenty, Chanel, Dior, Aime Leon Dore, Loewe, Jacquemus, Glossier, Hermès, Le Labo, Poppi, Liquid Death. Your job: cinematic, editorial, magazine-worthy product photographs that stop the scroll.

You will receive a product sheet and must invent shot CONCEPTS for a photoshoot. Return ONLY valid JSON:
{"shots": [{"concept": "3-6 word label", "prompt": "one dense sentence describing the exact shot: (a) hero action or arrangement, (b) surface + backdrop with real texture (wet basalt, brushed marble, raw silk, sand dune, mossy stone, rippling water, painted plaster, velvet, chiffon, gold leaf, blooming florals), (c) lighting mood (hard midday sun, low golden hour rim, dramatic single-point studio, moody chiaroscuro, soft north-window daylight, coloured gel wash), (d) camera angle + lens feel (macro 100mm, low hero 35mm, top-down flat-lay, dutch tilt), (e) one confident creative twist that makes it magazine-cover material — floating in mid-air with a suspended droplet, half-submerged with concentric ripples, cradled by real hands with wet fingertips, nested in fresh citrus halves, resting on a slab of ice with fog rolling off, hung inside a fruit-mesh net bag, tucked into lush jungle foliage with dappled light, echoed by a giant Grecian shadow, framed by fabric caught mid-motion."}]}

Rules:
- Every shot in the batch must be a DIFFERENT format and different mood/palette — never two similar ideas. Mix at least across these families: (i) editorial hero on textured surface, (ii) mid-air / floating / suspended, (iii) elemental (in water, ice, fire, smoke, sand), (iv) natural world (florals, foliage, fruit, moss, jungle, coastline), (v) architectural / sculptural set (columns, arches, coloured plinths), (vi) hands-in-frame candid moment, (vii) monochrome duotone graphic set with a hard-cast shadow.
- NEVER reuse any concept from the AVOID list — those were already shot.
- Concepts must physically suit THIS product's category (drinks: splash / pour / condensation / ice; skincare: droplet / smear / stone / florals; fragrance: mist / silk / architectural plinth / dramatic light; apparel: drape / hanger / motion / model-not-required; food: hero stack / ingredient explosion / mid-air scatter).
- NATURAL HANDLING ONLY: hands interact the way a real person gently would — cradling a bottle, holding a garment by the shoulder seams, lifting from below. NEVER stretching, pinching, crumpling, squeezing or otherwise deforming the product; it must keep its exact natural shape so the design stays readable. No awkward grips, no contorted fingers.
- Aesthetic bar: this must look like a $10k campaign shoot, not a Shopify placeholder. Confident negative space, real material textures (not plastic-looking CG), true light with real shadows, a specific colour story per shot (never neutral beige on white unless intentional). Cinematic > cute.
- No people's faces (hands and out-of-focus silhouettes are fine) UNLESS the brief includes a recurring creator — then they appear candidly using the product as instructed. No text overlays, no watermarks, no props that steal focus.
- Do not describe the product's own appearance — the image model receives its photos separately and must preserve packaging, labels and colours exactly.`

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const header = request.headers.get('Authorization')
    if (!header?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData } = await supabase.auth.getUser(header.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = userData.user.id
    const { id } = await params

    const body = await request.json()
    const direction = typeof body?.direction === 'string' ? body.direction.trim().slice(0, 400) : ''
    const count = Math.min(4, Math.max(1, Number(body?.count) || 2))
    const ratio: '1:1' | '4:5' | '9:16' | '16:9' =
      body?.ratio === '1:1' || body?.ratio === '9:16' || body?.ratio === '16:9' ? body.ratio : '4:5'
    const quality: 'nb2' | 'pro' | '4k' = body?.quality === 'nb2' ? 'nb2' : body?.quality === '4k' ? '4k' : 'pro'
    const influencerId = typeof body?.influencerId === 'string' && body.influencerId.length > 0 ? body.influencerId : null
    // Mode picks which concept system + rendering prompt runs:
    //  'aesthetic' = editorial lifestyle product photos (default).
    //  'ad' = bold typographic promo graphics (Listicle / Social Proof / Feature Callout).
    const mode: 'aesthetic' | 'ad' = body?.mode === 'ad' ? 'ad' : 'aesthetic'
    const model: 'pro' | 'nb2' = quality === 'nb2' ? 'nb2' : 'pro'
    const totalCost = CR[quality] * count

    const { data: product } = await supabase
      .from('user_studio_products')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    // Optional: one of the user's AI influencers features in the shots —
    // wearing / holding / using the product, candid.
    let influencer: { name: string; appearance_prompt: string; portrait_url: string; character_sheet_url?: string | null } | null = null
    let identityRefs: Array<{ base64: string; mimeType: string }> = []
    if (influencerId) {
      const { data: inf } = await supabase
        .from('user_influencers')
        .select('name, appearance_prompt, portrait_url, character_sheet_url')
        .eq('id', influencerId)
        .eq('user_id', userId)
        .maybeSingle()
      if (inf) {
        influencer = inf
        const refUrls = [inf.character_sheet_url, inf.portrait_url].filter(
          (u): u is string => typeof u === 'string' && u.startsWith('http'),
        )
        identityRefs = (await Promise.all(refUrls.map(async url => {
          try {
            const r = await fetch(url)
            if (!r.ok) return null
            return {
              base64: Buffer.from(await r.arrayBuffer()).toString('base64'),
              mimeType: r.headers.get('content-type') || 'image/png',
            }
          } catch { return null }
        }))).filter((x): x is { base64: string; mimeType: string } => !!x)
      }
    }

    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .maybeSingle()
    if (!credits || credits.balance < totalCost) {
      return NextResponse.json({ error: `Insufficient credits. Need ${totalCost}.` }, { status: 402 })
    }

    // Recent concepts → the avoid list that keeps batches fresh.
    const { data: recent } = await supabase
      .from('user_studio_product_photos')
      .select('concept')
      .eq('product_id', id)
      .order('created_at', { ascending: false })
      .limit(10)
    const avoid = [...new Set((recent ?? []).map(r => String(r.concept)))].filter(Boolean)

    // 1) Sonnet invents distinct concepts.
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 900,
      system: mode === 'ad' ? AD_CONCEPT_SYSTEM : CONCEPT_SYSTEM,
      messages: [{
        role: 'user',
        content: `PRODUCT SHEET:\nName: ${product.name}\nCategory: ${product.category ?? 'unknown'}\nDescription: ${product.description ?? ''}\n\nSHOTS NEEDED: ${count}\nAVOID (already shot): ${avoid.length ? avoid.join(' · ') : '(nothing yet)'}\n${influencer ? (mode === 'ad'
          ? `\nA RECURRING MODEL features in every ad: they appear clearly (face visible, not obscured, not headless) either holding/wearing/using the product, or as a portrait beside it. Do not describe their appearance — the image model receives their photos. In your concept prompts, tell the model exactly where the person sits in the composition relative to the headline copy and the product, and how their face is framed (three-quarter portrait, candid mid-motion, direct look to camera, side profile). Never crop the head off, never let the product cover the face.`
          : `\nA RECURRING CREATOR features in every shot: they are candidly USING the product — wearing it if it's apparel/footwear, holding/pouring/applying otherwise. Mid-action, natural, NOT posing at the camera, doesn't have to be centered. Do not describe their appearance (the image model receives their photos).`
        ) : ''}${direction ? `\nUSER DIRECTION — every concept must build on this while staying distinct from each other: "${direction}"` : ''}`,
      }],
    })
    const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim()
      .replace(/^```json?\n?/i, '').replace(/\n?```$/, '')
    let shots: Array<{ concept: string; prompt: string }>
    try {
      const parsed = JSON.parse(raw) as { shots?: Array<{ concept?: string; prompt?: string }> }
      shots = (parsed.shots ?? [])
        .filter(sh => sh?.prompt)
        .map(sh => ({ concept: String(sh.concept ?? 'shot').slice(0, 80), prompt: String(sh.prompt).slice(0, 600) }))
        .slice(0, count)
    } catch {
      return NextResponse.json({ error: 'Concept generation failed — try again' }, { status: 500 })
    }
    if (!shots.length) return NextResponse.json({ error: 'No concepts generated — try again' }, { status: 500 })

    // Product fidelity refs (up to 3 angles).
    const refUrls: string[] = Array.isArray(product.photo_urls) ? product.photo_urls.slice(0, 3) : []
    const productRefs = (await Promise.all(refUrls.map(async (url: string) => {
      try {
        const r = await fetch(url)
        if (!r.ok) return null
        return {
          base64: Buffer.from(await r.arrayBuffer()).toString('base64'),
          mimeType: r.headers.get('content-type') || 'image/png',
        }
      } catch { return null }
    }))).filter((x): x is { base64: string; mimeType: string } => !!x)
    if (!productRefs.length) throw new Error('Could not load product reference photos')

    // 2) Render each concept — ad mode uses a punchy graphic-poster prompt.
    const results = await Promise.allSettled(shots.map(sh => {
      const adPersonClause = influencer
        ? `\n\n★ PERSON IN THE AD — non-negotiable ★ The FIRST reference image(s) define the exact model appearing in this ad. Their face must be fully visible and correctly rendered — three-quarter or direct-look framing, matching their real features from the reference. NEVER crop the head off, NEVER let the product, headline text, or any element cover the face, NEVER render a headless torso. The person and the product co-exist in the composition (they hold, wear or stand beside it) alongside the typography.`
        : ''
      const adPrompt = `${sh.prompt}\n\nScroll-stopping social-media ad / promotional poster in the style of top DTC campaigns (Nike, Fenty, Aime Leon Dore, Poppi, Liquid Death). Follow the style called out in the concept — could be BOLD TYPOGRAPHIC (saturated single-colour background with a massive display headline), AESTHETIC EDITORIAL TYPE (magazine-cover feel: elegant type layered over a real styled scene with muted palette and negative space), or LOGO / MINIMAL BRAND (product + wordmark as the whole composition, monochrome or two-tone).\n\nTypography must be a real modern typeface: ultra-bold condensed sans, high-contrast serif, or refined italic — sharp, correctly spelled, kerned tight, sized like a campaign headline. Support the hero copy with small confident micro-details when it fits: a star bar ★★★★★, a green "SHOP NOW" pill, a corner price tag, a #SALE diagonal stripe repeat, an embossed brand mark, a rotated tag. Composition has real art direction: strong grid, off-centre product, oversized headline, purposeful negative space, occasional accent word in a contrasting colour.\n\nThe product sits inside the composition as a clean, well-lit cut-out (subtle contact shadow). Preserve the product's exact packaging, labels, logos and colours. Render the typography TACK-SHARP with correct spelling and real kerning; no gibberish, no lorem ipsum, no ghost letters.${adPersonClause}`
      const aestheticPromptWithInf = `${influencer?.appearance_prompt}\n\nShot: ${sh.prompt}\n\nCinematic editorial campaign photograph in the style of Vogue / Kinfolk / Aesop / Jacquemus. The person is candidly mid-action with the product — natural imperfect skin (real pores, no plastic AI-smooth face, no over-symmetry), relaxed anatomically-correct hands, unposed body language, doesn't have to be centered. Real light with real directional shadows, hyper-real materials and textures (skin, fabric, glass, liquid, stone), rich intentional colour palette per shot. The product keeps its exact natural undistorted shape and every label/logo stays legible. No text overlays, no watermarks, no camera UI, no lens flare artefacts, no floating debris unless the concept called for it.`
      const aestheticPrompt = `${sh.prompt}\n\nCinematic editorial product photograph in the style of a top DTC / heritage brand campaign (Aesop, Chanel, Loewe, Fenty, Poppi). Hyper-real materials with true surface textures (wet stone, silk, glass, water ripples, moss, marble, sand), real directional lighting with real shadows, rich intentional colour palette, magazine-cover level composition and negative space. The product keeps its exact natural undistorted shape and every label/logo stays crisp and legible. Any hands in frame are relaxed and anatomically correct. No text overlays, no watermarks, no camera UI, no human faces, no plastic-looking CG feel.`
      const finalPrompt = mode === 'ad'
        ? adPrompt
        : (influencer ? aestheticPromptWithInf : aestheticPrompt)
      return generateNanoBananaImage(finalPrompt, {
        style: mode === 'ad' && !influencer ? 'professional' : (influencer ? 'realistic' : 'professional'),
        ratio,
        model,
        resolution: quality === '4k' ? '4K' : undefined,
        referenceImages: mode === 'ad'
          ? (influencer ? [...identityRefs, ...productRefs] : productRefs)
          : (influencer ? [...identityRefs, ...productRefs] : productRefs),
        referenceHint: mode === 'ad'
          ? (influencer
            ? `The FIRST reference image(s) define the exact person appearing in the ad — face, hair, skin tone, build. Render their FACE FULLY VISIBLE and matching the reference; never crop the head, never let the product or typography cover the face. The LAST image(s) show the EXACT product — preserve packaging, labels, colours and proportions perfectly; never redesign it. Compose person + product + typography into a scroll-stopping campaign ad.`
            : 'The attached reference photos show the EXACT product — preserve its packaging, label text, colours, shape and proportions perfectly. Use it as a clean cut-out inside a bold graphic poster; the typography and coloured background are the composition. Never redesign the product.')
          : (influencer
            ? `The FIRST reference image(s) define the exact person — face, hair, skin tone, build ONLY; their clothing may change per the prompt${(product.category === 'apparel' || product.category === 'footwear') ? ' (they WEAR the product)' : ''}. The LAST image(s) show the EXACT product — preserve its packaging, label text, colours, shape and proportions perfectly; never redesign it.`
            : 'The attached reference photos show the EXACT product (multiple angles of the same item) — preserve its packaging, label text, colours, shape, materials and proportions perfectly. Apply the prompt as the scene, arrangement, and styling around it; never redesign the product.'),
      })
    }))

    const photos: Array<{ id: string; concept: string; image_url: string; created_at: string }> = []
    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      if (r.status !== 'fulfilled') continue
      const filename = `product-studio/${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-shot.png`
      const { error: upErr } = await supabase.storage
        .from('ugc-assets')
        .upload(filename, Buffer.from(r.value.imageBase64, 'base64'), { contentType: r.value.mimeType, upsert: false })
      if (upErr) continue
      const url = supabase.storage.from('ugc-assets').getPublicUrl(filename).data.publicUrl
      const { data: row } = await supabase
        .from('user_studio_product_photos')
        .insert({ product_id: id, user_id: userId, concept: shots[i].concept, prompt: shots[i].prompt, image_url: url })
        .select('id, concept, image_url, created_at')
        .single()
      if (row) photos.push(row)
    }
    if (!photos.length) {
      return NextResponse.json({ error: 'All shots failed to render — try again' }, { status: 500 })
    }

    const charged = CR[quality] * photos.length
    const { newBalance, newPackCredits } = await deductCredits(
      supabase, userId, charged, credits.balance, credits.pack_credits ?? 0,
    )
    await supabase.from('user_credits')
      .update({ balance: newBalance, pack_credits: newPackCredits })
      .eq('user_id', userId)
    await supabase.from('user_studio_products')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ photos, creditsCharged: charged })
  } catch (err) {
    console.error('[products-studio/photoshoot] failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
