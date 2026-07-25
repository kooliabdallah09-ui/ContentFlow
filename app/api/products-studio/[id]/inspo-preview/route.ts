import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchStyleInspoImages } from '@/lib/trends/image-search'
import { inferProductCategory } from '@/lib/multi-shot'

export const maxDuration = 60

// Preview endpoint for the "Match a proven style" toggle in Product Studio.
// Fetches 4 real category ads via Tavily and returns them as base64 data
// URLs the client can render inline. The client then passes the accepted
// images back to /photoshoot so we don't re-fetch on shoot time.

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const header = request.headers.get('Authorization')
    if (!header?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: userData } = await supabase.auth.getUser(header.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = userData.user.id
    const { id } = await params

    const { data: product } = await supabase
      .from('user_studio_products')
      .select('id, name, description')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const category = await inferProductCategory({
      productName: product.name,
      productDescription: product.description ?? '',
    }).catch(() => undefined)

    const { images } = await fetchStyleInspoImages({
      productName: product.name,
      productCategory: category,
    })

    if (images.length === 0) {
      return NextResponse.json({
        images: [],
        note: process.env.TAVILY_API_KEY
          ? 'No inspiration images found for this category. Try shooting without style match.'
          : 'TAVILY_API_KEY is not configured — image search is unavailable.',
      })
    }

    // Return as data URLs the client can drop straight into <img src>.
    return NextResponse.json({
      images: images.slice(0, 4).map(img => ({
        dataUrl: `data:${img.mimeType};base64,${img.base64}`,
        base64: img.base64,
        mimeType: img.mimeType,
        sourceUrl: img.sourceUrl,
      })),
      category,
    })
  } catch (err) {
    console.error('inspo-preview error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Preview failed' }, { status: 500 })
  }
}
