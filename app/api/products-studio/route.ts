// Product Studio — create + list persistent products.
//
// POST { name?, photos: [{base64,mimeType}] } — uploads the reference
// angles, has Sonnet (vision) study them and write the product sheet
// (name, category, description, canonical appearance prompt). 5 cr.
// GET — list the user's products.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/deduct-credits'

export const maxDuration = 120

export const PRODUCT_CREATE_CR = 5

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function authUser(request: NextRequest): Promise<string | null> {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const { data } = await supa().auth.getUser(header.slice(7))
  return data.user?.id ?? null
}

export async function GET(request: NextRequest) {
  try {
    const userId = await authUser(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data, error } = await supa()
      .from('user_studio_products')
      .select('id, name, category, description, photo_urls, created_at, last_used_at')
      .eq('user_id', userId)
      .order('last_used_at', { ascending: false })
      .limit(100)
    if (error) throw error
    return NextResponse.json({ products: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

const SHEET_SYSTEM = `You are a product photographer's assistant building a product sheet from reference photos.

Study ALL attached photos of the product (they show different angles of the SAME product). Return ONLY valid JSON:
{
  "name": "short product name — read it off the packaging if visible",
  "category": "one word-ish: drink / candy / snack / skincare / cosmetics / apparel / footwear / electronics / supplement / other",
  "description": "1-2 sentences: what it is, who it's for",
  "appearance_prompt": "a dense visual description an image model can use to render this EXACT product faithfully: packaging type + material, colours, label text and layout, logo placement, cap/closure, proportions, finish (matte/gloss), contents if visible"
}`

export async function POST(request: NextRequest) {
  try {
    const userId = await authUser(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = supa()

    const body = await request.json()
    const photos: Array<{ base64: string; mimeType: string }> = Array.isArray(body?.photos)
      ? body.photos
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((p: any) => typeof p?.base64 === 'string' && p.base64.length > 100 && typeof p?.mimeType === 'string')
          .slice(0, 5)
      : []
    if (!photos.length) return NextResponse.json({ error: 'Upload at least one product photo' }, { status: 400 })
    const userName = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : ''

    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .maybeSingle()
    if (!credits || credits.balance < PRODUCT_CREATE_CR) {
      return NextResponse.json({ error: `Insufficient credits. Need ${PRODUCT_CREATE_CR}.` }, { status: 402 })
    }

    // 1) Sonnet studies every angle and writes the sheet.
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const content: Anthropic.ContentBlockParam[] = photos.map(p => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: p.mimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
        data: p.base64,
      },
    }))
    content.push({ type: 'text', text: userName ? `The product is called "${userName}" — use this exact name.` : 'Build the product sheet.' })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      system: SHEET_SYSTEM,
      messages: [{ role: 'user', content }],
    })
    const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim()
      .replace(/^```json?\n?/i, '').replace(/\n?```$/, '')
    let sheet: { name?: string; category?: string; description?: string; appearance_prompt?: string }
    try { sheet = JSON.parse(raw) } catch {
      return NextResponse.json({ error: 'Product analysis failed — try clearer photos' }, { status: 500 })
    }
    if (!sheet.appearance_prompt) {
      return NextResponse.json({ error: 'Could not read the product — try clearer photos' }, { status: 500 })
    }

    // 2) Upload the reference angles.
    const photoUrls: string[] = []
    for (const p of photos) {
      const filename = `product-studio/${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
      const { error: upErr } = await supabase.storage
        .from('ugc-assets')
        .upload(filename, Buffer.from(p.base64, 'base64'), { contentType: p.mimeType, upsert: false })
      if (!upErr) photoUrls.push(supabase.storage.from('ugc-assets').getPublicUrl(filename).data.publicUrl)
    }
    if (!photoUrls.length) throw new Error('Photo upload failed')

    const { data: product, error: insErr } = await supabase
      .from('user_studio_products')
      .insert({
        user_id: userId,
        name: (userName || String(sheet.name ?? 'Product')).slice(0, 80),
        category: typeof sheet.category === 'string' ? sheet.category.slice(0, 40) : null,
        description: typeof sheet.description === 'string' ? sheet.description.slice(0, 400) : null,
        appearance_prompt: String(sheet.appearance_prompt).slice(0, 2000),
        photo_urls: photoUrls,
      })
      .select('*')
      .single()
    if (insErr) throw insErr

    const { newBalance, newPackCredits } = await deductCredits(
      supabase, userId, PRODUCT_CREATE_CR, credits.balance, credits.pack_credits ?? 0,
    )
    await supabase.from('user_credits')
      .update({ balance: newBalance, pack_credits: newPackCredits })
      .eq('user_id', userId)

    return NextResponse.json({ product, creditsCharged: PRODUCT_CREATE_CR }, { status: 201 })
  } catch (err) {
    console.error('[products-studio] create failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
