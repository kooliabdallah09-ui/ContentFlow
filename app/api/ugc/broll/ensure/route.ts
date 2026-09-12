import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { submitKenBurnsClip } from '@/lib/shotstack'
import { pickKenBurnsMotion, DEFAULT_CUTAWAY_SECONDS } from '@/lib/broll'

export const maxDuration = 60

// Hand back a product B-roll cutaway, building one only if the product has
// none spare.
//
// Deliberately lazy: generating a batch of clips when a product is created
// spends money on cutaways that may never be used, and on a 30-credit free
// tier that lands before the user has seen a single finished ad. Instead the
// library fills in as ads get made.
//
// The clip is a Shotstack pan/zoom over a still the product already has, so
// this costs no credits — the caller isn't charged.

const MAX_CLIPS_PER_PRODUCT = 6

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

    const body = await request.json().catch(() => ({}))
    const productId = typeof body.productId === 'string' ? body.productId : ''
    const aspect = body.aspect === 'square' || body.aspect === 'landscape' ? body.aspect : 'portrait'
    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    // Ownership check — RLS doesn't apply to the service-role client.
    const { data: product } = await supabase
      .from('user_studio_products')
      .select('id, user_id, photo_urls')
      .eq('id', productId)
      .eq('user_id', userId)
      .maybeSingle()
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // 1. Reuse the least-recently-used clip so consecutive ads for the same
    //    product don't keep showing the identical cutaway.
    const { data: existing } = await supabase
      .from('user_product_brolls')
      .select('id, clip_url, duration_seconds, motion, use_count')
      .eq('product_id', productId)
      .order('last_used_at', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true })

    const clips = existing ?? []
    if (clips.length > 0) {
      const pick = clips[0]
      await supabase
        .from('user_product_brolls')
        .update({ use_count: (pick.use_count ?? 0) + 1, last_used_at: new Date().toISOString() })
        .eq('id', pick.id)

      return NextResponse.json({
        status: 'ready',
        brollId: pick.id,
        clipUrl: pick.clip_url,
        durationSeconds: Number(pick.duration_seconds) || DEFAULT_CUTAWAY_SECONDS,
        cached: true,
      })
    }

    if (clips.length >= MAX_CLIPS_PER_PRODUCT) {
      return NextResponse.json({ error: 'B-roll library is full for this product' }, { status: 409 })
    }

    // 2. Nothing cached — build one from a still the product already has.
    //    Prefer generated gallery shots (art-directed) over raw uploads.
    const { data: gallery } = await supabase
      .from('user_studio_product_photos')
      .select('image_url')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(MAX_CLIPS_PER_PRODUCT)

    const uploaded: string[] = Array.isArray(product.photo_urls)
      ? (product.photo_urls as unknown[]).filter((u): u is string => typeof u === 'string')
      : []
    const candidates = [...(gallery ?? []).map(g => g.image_url), ...uploaded].filter(Boolean)

    if (candidates.length === 0) {
      return NextResponse.json({
        error: 'This product has no photos yet — add one in Product Studio to enable cutaways.',
        code: 'no_source_image',
      }, { status: 422 })
    }

    const sourceImage = candidates[clips.length % candidates.length]
    const motion = pickKenBurnsMotion(clips.length)

    const { renderId } = await submitKenBurnsClip({
      imageUrl: sourceImage,
      durationSeconds: DEFAULT_CUTAWAY_SECONDS,
      motion,
      aspect,
    })

    // Row is written once the render finishes (see /api/ugc/broll/save) — a
    // half-rendered clip URL in the cache would break later ads.
    return NextResponse.json({
      status: 'rendering',
      renderId,
      sourceImage,
      motion,
      durationSeconds: DEFAULT_CUTAWAY_SECONDS,
      cached: false,
    })
  } catch (err) {
    console.error('broll/ensure error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not prepare B-roll' },
      { status: 500 },
    )
  }
}
