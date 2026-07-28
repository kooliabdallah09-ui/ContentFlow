import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// POST { frameUrls: string[], concept?: string }
// Saves UGC hero frames (or any frame URLs) into the product's photo gallery
// so they appear in Product Studio alongside regular photoshoot results.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
    const { id } = await params

    const body = await request.json()
    const frameUrls: unknown = body.frameUrls
    const concept: string = typeof body.concept === 'string' ? body.concept : 'UGC hero frame'

    if (!Array.isArray(frameUrls) || frameUrls.length === 0) {
      return NextResponse.json({ error: 'frameUrls required' }, { status: 400 })
    }

    const urls = (frameUrls as unknown[])
      .filter((u): u is string => typeof u === 'string' && u.startsWith('http'))
      .slice(0, 8)

    if (!urls.length) {
      return NextResponse.json({ error: 'No valid URLs provided' }, { status: 400 })
    }

    // Verify the product belongs to this user.
    const { data: product } = await supabase
      .from('user_studio_products')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const rows = urls.map((url, i) => ({
      product_id: id,
      user_id: userId,
      image_url: url,
      concept: `${concept} — option ${i + 1}`,
      prompt: '',
    }))

    const { data: inserted, error: insertErr } = await supabase
      .from('user_studio_product_photos')
      .insert(rows)
      .select('id, image_url')

    if (insertErr) {
      console.error('[save-frames] insert error:', insertErr.message)
      return NextResponse.json({ error: 'Failed to save frames' }, { status: 500 })
    }

    return NextResponse.json({ saved: inserted?.length ?? 0 })
  } catch (err) {
    console.error('[save-frames]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
