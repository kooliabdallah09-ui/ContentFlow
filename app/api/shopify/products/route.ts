import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const storeUrl = request.nextUrl.searchParams.get('store')
  if (!storeUrl) return NextResponse.json({ error: 'Missing store' }, { status: 400 })

  // Normalize: strip https://, trailing slash, add /products.json?limit=50
  // Handle both mystore.myshopify.com and custom domains
  const host = storeUrl.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase()

  try {
    const res = await fetch(`https://${host}/products.json?limit=50`, {
      headers: { 'Accept': 'application/json' },
      // 8 second timeout
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`Store returned ${res.status}`)
    const data = await res.json()
    // Return only what we need: id, title, handle, body_html, images[0..2], variants[0].price
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
