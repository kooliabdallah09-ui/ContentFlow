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

// Same tiers as the quick image generator: NB2 5 · Pro 2K 10 · Pro 4K 18.
const CR = { nb2: 5, pro: 10, '4k': 18 } as const

const CONCEPT_SYSTEM = `You are an award-winning product photographer and art director (think modern DTC brands: playful, clean, editorial — stacked hero towers, mid-air splashes, pours, texture spreads on stone, hands interacting, monochrome sets, hard-light shadows).

You will receive a product sheet and must invent shot CONCEPTS for a photoshoot. Return ONLY valid JSON:
{"shots": [{"concept": "3-6 word label", "prompt": "one dense sentence describing the exact shot: arrangement/action, surface + backdrop, lighting, camera angle"}]}

Rules:
- Every shot in the batch must be a DIFFERENT format (never two of the same idea: if one is a stacked tower, the next is a splash or a flat spread or a hands-pour…).
- NEVER reuse any concept from the AVOID list — those were already shot.
- Concepts must physically suit THIS product's category (drinks splash and pour; candy stacks and scatters; skincare smears and drips; apparel drapes and floats).
- Clean aesthetic: seamless pastel or stone backdrops, controlled studio light or hard sun, negative space, premium but playful. No people's faces (hands are fine) UNLESS the brief includes a recurring creator — then they appear candidly using the product as instructed. No text overlays, no props that steal focus.
- Do not describe the product's own appearance — the image model receives its photos separately.`

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
      system: CONCEPT_SYSTEM,
      messages: [{
        role: 'user',
        content: `PRODUCT SHEET:\nName: ${product.name}\nCategory: ${product.category ?? 'unknown'}\nDescription: ${product.description ?? ''}\n\nSHOTS NEEDED: ${count}\nAVOID (already shot): ${avoid.length ? avoid.join(' · ') : '(nothing yet)'}\n${influencer ? `\nA RECURRING CREATOR features in every shot: they are candidly USING the product — wearing it if it's apparel/footwear, holding/pouring/applying otherwise. Mid-action, natural, NOT posing at the camera, doesn't have to be centered. Do not describe their appearance (the image model receives their photos).` : ''}${direction ? `\nUSER DIRECTION — every concept must build on this while staying distinct from each other: "${direction}"` : ''}`,
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

    // 2) Render each concept.
    const results = await Promise.allSettled(shots.map(sh =>
      generateNanoBananaImage(
        influencer
          ? `${influencer.appearance_prompt}\n\nShot: ${sh.prompt}\n\nThe person is candidly mid-action with the product — natural face, no plastic face, no AI-smooth skin, not posing at the camera, doesn't have to be centered. Editorial photograph, hyper-real materials and lighting, clean aesthetic, no text overlays, no watermarks, no camera interface.`
          : `${sh.prompt}\n\nEditorial product photograph, hyper-real materials and lighting, clean aesthetic, no text overlays, no watermarks, no camera interface, no human faces.`,
        {
          style: influencer ? 'realistic' : 'professional',
          ratio,
          model,
          resolution: quality === '4k' ? '4K' : undefined,
          referenceImages: influencer ? [...identityRefs, ...productRefs] : productRefs,
          referenceHint: influencer
            ? `The FIRST reference image(s) define the exact person — face, hair, skin tone, build ONLY; their clothing may change per the prompt${(product.category === 'apparel' || product.category === 'footwear') ? ' (they WEAR the product)' : ''}. The LAST image(s) show the EXACT product — preserve its packaging, label text, colours, shape and proportions perfectly; never redesign it.`
            : 'The attached reference photos show the EXACT product (multiple angles of the same item) — preserve its packaging, label text, colours, shape, materials and proportions perfectly. Apply the prompt as the scene, arrangement, and styling around it; never redesign the product.',
        },
      ),
    ))

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
