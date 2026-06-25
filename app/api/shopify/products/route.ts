import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  // Gate to Pro and Agency plans only
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.slice(7))
  if (userError || !userData?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: credits } = await supabase
    .from('user_credits')
    .select('plan')
    .eq('user_id', userData.user.id)
    .single()

  if (!credits || !['pro', 'agency'].includes(credits.plan)) {
    return NextResponse.json({ error: 'Shopify import is available on Pro and Agency plans.' }, { status: 403 })
  }

  const storeUrl = request.nextUrl.searchParams.get('store')
  if (!storeUrl) return NextResponse.json({ error: 'Missing store' }, { status: 400 })

  const host = storeUrl.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase()

  try {
    const res = await fetch(`https://${host}/products.json?limit=50`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`Store returned ${res.status}`)
    const data = await res.json()
    const products = (data.products ?? []).map((p: Record<string, unknown>) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      body_html: p.body_html,
      price: (p as { variants?: Array<{ price: string }> }).variants?.[0]?.price ?? '',
      images: ((p as { images?: Array<{ src: string }> }).images ?? []).slice(0, 3).map((img: { src: string }) => img.src),
    }))
    return NextResponse.json({ products })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
