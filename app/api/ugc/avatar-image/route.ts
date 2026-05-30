import { NextRequest, NextResponse } from 'next/server'

// Proxy HeyGen avatar images — CDN returns 403 on direct browser requests
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) return new NextResponse('Missing url', { status: 400 })

  // Only allow HeyGen CDN URLs
  if (!url.startsWith('https://files2.heygen.ai/') && !url.startsWith('https://files.heygen.ai/')) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const apiKey = process.env.HEYGEN_API_KEY
  try {
    const res = await fetch(url, {
      headers: apiKey ? { 'X-Api-Key': apiKey } : {},
      next: { revalidate: 86400 }, // cache for 24h
    })

    if (!res.ok) return new NextResponse('Not found', { status: 404 })

    const buffer = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') ?? 'image/webp'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return new NextResponse('Failed', { status: 502 })
  }
}
