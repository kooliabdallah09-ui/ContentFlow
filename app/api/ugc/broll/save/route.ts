import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_CUTAWAY_SECONDS } from '@/lib/broll'

// Commit a finished Ken Burns render into the product's B-roll cache.
//
// Split out from /ensure on purpose: the clip URL is only valid once Shotstack
// reports `done`, and caching a URL for a still-rendering job would hand a
// broken cutaway to every later ad for that product.

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
    const clipUrl = typeof body.clipUrl === 'string' ? body.clipUrl : ''
    if (!productId || !clipUrl) {
      return NextResponse.json({ error: 'productId and clipUrl are required' }, { status: 400 })
    }
    if (!/^https?:\/\//.test(clipUrl)) {
      return NextResponse.json({ error: 'clipUrl must be an absolute URL' }, { status: 400 })
    }

    const { data: product } = await supabase
      .from('user_studio_products')
      .select('id')
      .eq('id', productId)
      .eq('user_id', userId)
      .maybeSingle()
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const { data: inserted, error } = await supabase
      .from('user_product_brolls')
      .insert({
        product_id: productId,
        user_id: userId,
        source: 'kenburns',
        clip_url: clipUrl,
        source_image_url: typeof body.sourceImage === 'string' ? body.sourceImage : null,
        motion: typeof body.motion === 'string' ? body.motion : null,
        duration_seconds: Number(body.durationSeconds) || DEFAULT_CUTAWAY_SECONDS,
        use_count: 1,
        last_used_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ brollId: inserted.id })
  } catch (err) {
    console.error('broll/save error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not save B-roll' },
      { status: 500 },
    )
  }
}
