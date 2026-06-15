import { NextRequest, NextResponse } from 'next/server'

// HeyGen has moved their preview CDN paths multiple times. Given a URL like
// .../avatar/v3/<id>/full/2.2/preview_target.webp we try a list of known-good
// variants before giving up. The first 200 with a non-trivial body wins.
function buildAlternates(originalUrl: string): string[] {
  const alts = new Set<string>([originalUrl])

  // Extract avatar id from the standard path: /avatar/v3/<id>/full/2.2/preview_target.webp
  const idMatch = originalUrl.match(/\/avatar\/v3\/([^/]+)\//)
  const id = idMatch?.[1]
  if (id) {
    alts.add(`https://files2.heygen.ai/avatar/v3/${id}/full/2.2/preview_target.webp`)
    alts.add(`https://files2.heygen.ai/avatar/v3/${id}/preview_target.webp`)
    alts.add(`https://files2.heygen.ai/avatar/v3/${id}/preview_image.webp`)
    alts.add(`https://files2.heygen.ai/avatar/v3/${id}/preview_image.png`)
    alts.add(`https://resource.heygen.ai/avatar/v3/${id}/preview_target.webp`)
  }

  return Array.from(alts)
}

// Proxy HeyGen avatar images — CDN sometimes returns 403/404/empty on direct browser requests.
// We try the requested URL first, then fall back to known alternate CDN paths and reject empty
// bodies (< 200 bytes) so the client's onError handler fires and the gradient fallback shows.
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) return new NextResponse('Missing url', { status: 400 })

  if (
    !url.startsWith('https://files2.heygen.ai/') &&
    !url.startsWith('https://files.heygen.ai/') &&
    !url.startsWith('https://resource.heygen.ai/')
  ) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const apiKey = process.env.HEYGEN_API_KEY
  const headers: Record<string, string> = apiKey ? { 'X-Api-Key': apiKey } : {}

  for (const candidate of buildAlternates(url)) {
    try {
      const res = await fetch(candidate, { headers, next: { revalidate: 86400 } })
      if (!res.ok) continue
      const buffer = await res.arrayBuffer()
      if (buffer.byteLength < 200) continue // empty stub — try next variant
      const contentType = res.headers.get('content-type') ?? 'image/webp'
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400, s-maxage=604800',
        },
      })
    } catch {
      // try next variant
    }
  }

  return new NextResponse('Not found', { status: 404 })
}
