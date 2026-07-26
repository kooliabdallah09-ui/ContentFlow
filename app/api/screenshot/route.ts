import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

// Fetch a landing-page screenshot for a given URL via the Microlink API
// (free tier, no key required). Returns the screenshot's public URL, plus a
// base64-encoded copy so callers can feed it directly into Nano Banana as a
// reference image the same way they do product photos.
//
// The response is intentionally shaped like the productImage state slot in
// UGCPackageBuilder — `imageBase64` + `mimeType` — so the website product-
// type path can drop straight into the existing pipeline with no new
// plumbing downstream.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const rawUrl = typeof body?.url === 'string' ? body.url.trim() : ''
    if (!rawUrl) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }

    // Normalise — accept "example.com" as well as full URLs.
    let normalised = rawUrl
    if (!/^https?:\/\//i.test(normalised)) normalised = `https://${normalised}`
    try { new URL(normalised) } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    // Ask Microlink for a screenshot. We use the JSON endpoint (no embed)
    // so we can pull the exact screenshot URL out of the payload, then
    // download the image bytes ourselves — this gives us clean base64 for
    // downstream Nano Banana use.
    const microlinkEndpoint = `https://api.microlink.io/?url=${encodeURIComponent(normalised)}&screenshot=true&meta=false&viewport.width=1440&viewport.height=900&type=png`

    const res = await fetch(microlinkEndpoint, {
      headers: { Accept: 'application/json' },
      // Microlink can take a while to render a heavy page.
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: `Screenshot service returned ${res.status}. Try a different URL.` },
        { status: 502 },
      )
    }

    const contentType = res.headers.get('content-type') ?? ''
    let screenshotUrl: string | null = null
    let imageBuffer: ArrayBuffer | null = null
    let mimeType = 'image/png'

    if (contentType.includes('application/json')) {
      const json = (await res.json()) as {
        status?: string
        data?: { screenshot?: { url?: string; type?: string } }
        message?: string
      }
      if (json.status !== 'success' || !json.data?.screenshot?.url) {
        return NextResponse.json(
          { error: json.message || 'Could not capture a screenshot of that URL.' },
          { status: 502 },
        )
      }
      screenshotUrl = json.data.screenshot.url
      const imgRes = await fetch(screenshotUrl, { signal: AbortSignal.timeout(20_000) })
      if (!imgRes.ok) {
        return NextResponse.json(
          { error: `Downloading screenshot failed (${imgRes.status})` },
          { status: 502 },
        )
      }
      imageBuffer = await imgRes.arrayBuffer()
      mimeType = imgRes.headers.get('content-type') || json.data.screenshot.type || 'image/png'
    } else if (contentType.startsWith('image/')) {
      // Microlink returned raw image bytes directly.
      imageBuffer = await res.arrayBuffer()
      mimeType = contentType
    } else {
      return NextResponse.json(
        { error: `Unexpected response type from screenshot service: ${contentType}` },
        { status: 502 },
      )
    }

    if (!imageBuffer) {
      return NextResponse.json({ error: 'No image data returned' }, { status: 502 })
    }

    const imageBase64 = Buffer.from(imageBuffer).toString('base64')
    return NextResponse.json({
      imageUrl: screenshotUrl,
      imageBase64,
      mimeType,
      sourceUrl: normalised,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Screenshot failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
