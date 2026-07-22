// Scene Studio — create + list persistent AI-rendered environments that
// downstream shoots (Influencer photoshoots, UGC packages, Product Studio ads)
// can pick from as a location anchor.
//
// POST body: { description?, referenceImages?, category? }
//   - description: freeform prompt ("a warm Brooklyn café with exposed brick…")
//   - referenceImages: [{ base64, mimeType }] — 1-3 real photos of the place
//   - Sonnet expands into a location brief (name, category, description,
//     scene_prompt), then Nano Banana Pro renders an empty-scene hero photo.
//     Original user references persist so downstream shoots re-anchor to them
//     (same drift-prevention pattern as user_influencers.reference_urls).
//
// GET — list the user's scenes.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { generateNanoBananaImage } from '@/lib/nanobanana'
import { deductCredits } from '@/lib/deduct-credits'

export const maxDuration = 120

// Sonnet brief + one NB Pro 2K hero render — roughly $0.14 raw × 1.4 markup.
export const SCENE_CREATE_CR = 6
export const SCENE_CREATE_NB2_CR = 4

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function authed(request: NextRequest): Promise<{ userId: string } | null> {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const { data } = await supa().auth.getUser(header.slice(7))
  if (!data.user) return null
  return { userId: data.user.id }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authed(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supa()
      .from('user_scenes')
      .select('id, name, category, description, scene_prompt, hero_image_url, created_at, last_used_at')
      .eq('user_id', auth.userId)
      .order('last_used_at', { ascending: false, nullsFirst: false })
      .limit(200)
    if (error) throw error
    return NextResponse.json({ scenes: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

const SCENE_SYSTEM = `You are a location scout + set designer building a reusable environment for photo/video shoots. You will receive either a freeform description, or 1-3 real reference photos of a place, or both. Turn what you receive into a rich, opinionated Scene brief.

Return ONLY valid JSON, no markdown, exactly this shape:
{
  "name": "Short evocative title (2-5 words). e.g. 'Brooklyn Corner Café', 'Golden Hour Rooftop', 'Neon Alley Ramen'",
  "category": "one of: interior, exterior, studio, other",
  "description": "1-2 sentences describing the place in the user's own voice — what it feels like, what happens there.",
  "scene_prompt": "A detailed environment prompt (60-140 words) that a photorealistic image model can use to render the EMPTY scene. Include: architecture / materials (wood, brick, concrete, marble, tile, glass), decor + props visible in the frame (plants, artwork, furniture, signage), lighting (natural window light / neon rim / hard sun / soft overhead / practical lamps), palette (warm amber, cool blue, muted earth, saturated tropical), time of day, weather when relevant, and camera vantage (eye-level, low, top-down, wide, tight). DO NOT include any people or products in this prompt — the scene must be empty and reusable."
}

Rules:
- Never invent details that contradict the reference photos when provided.
- Choose materials, lighting, and palette that are internally consistent — an amber-lit café doesn't also have cold fluorescent overheads.
- \`scene_prompt\` must render as an EMPTY scene ready to be populated later — no models, mannequins, characters, or hero products.`

export async function POST(request: NextRequest) {
  try {
    const auth = await authed(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 800) : ''
    const model: 'pro' | 'nb2' = body?.model === 'nb2' ? 'nb2' : 'pro'
    const referenceImages: Array<{ base64: string; mimeType: string }> = Array.isArray(body?.referenceImages)
      ? body.referenceImages
          .filter((r: { base64?: unknown; mimeType?: unknown }) => typeof r?.base64 === 'string' && (r.base64 as string).length > 100 && typeof r?.mimeType === 'string')
          .slice(0, 3)
          .map((r: { base64: string; mimeType: string }) => ({ base64: r.base64, mimeType: r.mimeType }))
      : []
    if (description.length < 5 && !referenceImages.length) {
      return NextResponse.json({ error: 'Describe the scene or attach reference photos' }, { status: 400 })
    }

    const supabase = supa()

    const cost = model === 'nb2' ? SCENE_CREATE_NB2_CR : SCENE_CREATE_CR
    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', auth.userId)
      .maybeSingle()
    if (!credits || credits.balance < cost) {
      return NextResponse.json({ error: `Insufficient credits. Need ${cost}.` }, { status: 402 })
    }

    // 1) Sonnet writes the scene brief. When references are provided we let
    // it look at them so the prompt describes THIS place, not a generic idea.
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const userContent: Anthropic.ContentBlockParam[] = referenceImages.map(r => ({
      type: 'image',
      source: { type: 'base64', media_type: r.mimeType as 'image/png' | 'image/jpeg' | 'image/webp', data: r.base64 },
    }))
    userContent.push({
      type: 'text',
      text: referenceImages.length
        ? `The attached ${referenceImages.length === 1 ? 'photo shows' : 'photos show'} the EXACT place to base this Scene on. Client's freeform notes: ${description || '(none — infer everything from the photos)'}.`
        : `Client's freeform description of the place: ${description}`,
    })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 900,
      system: SCENE_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
    })
    const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim()
      .replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '')
    let brief: { name?: string; category?: string; description?: string; scene_prompt?: string }
    try { brief = JSON.parse(raw) } catch {
      return NextResponse.json({ error: 'Scene brief generation failed — try again' }, { status: 500 })
    }
    if (!brief.name || !brief.scene_prompt) {
      return NextResponse.json({ error: 'Scene brief incomplete — try again' }, { status: 500 })
    }

    // 2) Nano Banana Pro renders the empty-scene hero — 16:9 for the widest
    // reusable framing. When references are provided they anchor the render.
    const hero = await generateNanoBananaImage(brief.scene_prompt, {
      style: 'realistic',
      ratio: '16:9',
      model,
      referenceImages: referenceImages.length ? referenceImages : undefined,
      referenceHint: referenceImages.length
        ? 'The attached reference photos define this exact PLACE — architecture, materials, decor, palette, and lighting must match. Render the same environment EMPTY (no people, no products) so downstream shoots can populate it. Preserve visible signage, artwork, and distinctive props faithfully.'
        : undefined,
    })

    // 3) Persist the original references so future re-renders / downstream
    // shoots can re-anchor to them and avoid cumulative AI drift.
    const referenceUrls: string[] = []
    for (let i = 0; i < referenceImages.length; i++) {
      const r = referenceImages[i]
      const ext = r.mimeType.includes('png') ? 'png' : r.mimeType.includes('webp') ? 'webp' : 'jpg'
      const path = `scenes/${auth.userId}-${Date.now()}-ref-${i}.${ext}`
      const { error: refErr } = await supabase.storage
        .from('ugc-assets')
        .upload(path, Buffer.from(r.base64, 'base64'), { contentType: r.mimeType, upsert: false })
      if (refErr) {
        console.warn('[scenes] reference upload failed, skipping:', refErr.message)
        continue
      }
      referenceUrls.push(supabase.storage.from('ugc-assets').getPublicUrl(path).data.publicUrl)
    }

    const heroFilename = `scenes/${auth.userId}-${Date.now()}-hero.png`
    const { error: heroErr } = await supabase.storage
      .from('ugc-assets')
      .upload(heroFilename, Buffer.from(hero.imageBase64, 'base64'), { contentType: hero.mimeType, upsert: false })
    if (heroErr) throw new Error(`Scene hero upload failed: ${heroErr.message}`)
    const heroUrl = supabase.storage.from('ugc-assets').getPublicUrl(heroFilename).data.publicUrl

    // 4) Insert row.
    const { data: scene, error: insErr } = await supabase
      .from('user_scenes')
      .insert({
        user_id: auth.userId,
        name: String(brief.name).slice(0, 80),
        category: (['interior', 'exterior', 'studio', 'other'] as const).includes(brief.category as never) ? brief.category : 'other',
        description: typeof brief.description === 'string' ? brief.description.slice(0, 400) : null,
        scene_prompt: String(brief.scene_prompt).slice(0, 2000),
        hero_image_url: heroUrl,
        reference_urls: referenceUrls.length ? referenceUrls : null,
      })
      .select('*')
      .single()
    if (insErr) throw insErr

    // 5) Charge.
    const { newBalance, newPackCredits } = await deductCredits(
      supabase, auth.userId, cost, credits.balance, credits.pack_credits ?? 0,
    )
    await supabase.from('user_credits').update({ balance: newBalance, pack_credits: newPackCredits }).eq('user_id', auth.userId)

    return NextResponse.json({ scene, creditsCharged: cost })
  } catch (err) {
    console.error('[scenes/create] failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
