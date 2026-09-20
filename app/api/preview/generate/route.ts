import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { scrapeProductUrl } from '@/lib/preview-scraper'
import { submitSeedanceJob } from '@/lib/seedance'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, releaseRateLimit, getClientIp, formatRetryAfter } from '@/lib/rate-limit'

export const maxDuration = 60

// One free preview per IP per week. This is the loss leader — each preview is
// ~$0.18 of vendor spend against $0 of revenue — so the limiter is shared
// across instances and durable rather than in-process. See lib/rate-limit.ts.
const RATE_LIMIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000  // 7 days
const RATE_LIMIT = 1

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limit = await checkRateLimit('preview', ip, RATE_LIMIT, RATE_LIMIT_WINDOW_MS)
  if (!limit.ok) {
    return NextResponse.json({
      error: `You've already generated your free preview this week. Sign up for unlimited generations, or come back in ${formatRetryAfter(limit.retryAfterSeconds)}.`,
      code: 'rate_limited',
    }, { status: 429 })
  }

  // The slot is reserved above so a burst of concurrent requests can't all pass
  // the check together. It's handed back in the `finally` unless a Seedance job
  // was actually submitted, since only a submission costs money — a bad URL
  // shouldn't burn someone's one preview for the week.
  let submitted = false
  try {
    const body = await request.json().catch(() => ({}))
    const rawUrl = typeof body.url === 'string' ? body.url.trim().slice(0, 500) : ''
    if (!rawUrl) return NextResponse.json({ error: 'Product URL is required' }, { status: 400 })

    // Scrape product info from the URL
    let scraped
    try {
      scraped = await scrapeProductUrl(rawUrl)
    } catch (e) {
      return NextResponse.json({
        error: e instanceof Error ? e.message : "Couldn't read that product page",
      }, { status: 400 })
    }

    // Use the product image as the Seedance first_frame (skip NB Pro to keep
    // preview cost near zero). If the site didn't expose one, fall back to
    // pure text-to-video.
    let startImageUrl: string | undefined
    if (scraped.productImageUrl) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey)
          const imgRes = await fetch(scraped.productImageUrl, { signal: AbortSignal.timeout(8000) })
          if (imgRes.ok) {
            const buf = Buffer.from(await imgRes.arrayBuffer())
            const ext = (imgRes.headers.get('content-type') ?? 'image/jpeg').includes('png') ? 'png' : 'jpg'
            const filename = `preview-refs/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
            const { error: upErr } = await supabase.storage
              .from('ugc-assets')
              .upload(filename, buf, { contentType: imgRes.headers.get('content-type') ?? 'image/jpeg', upsert: false })
            if (!upErr) {
              startImageUrl = supabase.storage.from('ugc-assets').getPublicUrl(filename).data.publicUrl
            }
          }
        }
      } catch {
        // Fall back to text-to-video if the image can't be re-hosted.
      }
    }

    // Claude Haiku writes a 5-second UGC-style prompt from the product info.
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const promptMsg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Write a single Seedance 2.0 image-to-video prompt for a 5-second UGC-style ad clip of this product.

PRODUCT: ${scraped.productName}${scraped.productDescription ? `\nDESCRIPTION: ${scraped.productDescription}` : ''}${scraped.siteName ? `\nBRAND: ${scraped.siteName}` : ''}

Rules:
- Portrait 9:16, natural handheld feel, warm real-world lighting (not studio)
- Camera slowly reveals or rotates around the product; product stays hero
- No dialogue, no captions, no text overlays, no watermark, no phone UI
- Preserve the product exactly as shown in the reference photo — same packaging, same colors, same label
- One paragraph, under 400 characters. Just the prompt itself, no preamble.`,
      }],
    })
    const prompt = (promptMsg.content[0] as { type: 'text'; text: string }).text.trim().slice(0, 700)
    if (!prompt) return NextResponse.json({ error: 'Failed to write preview prompt' }, { status: 500 })

    // Submit Seedance Mini @ 480p / 5s / no audio — cheapest possible config.
    // Watermark ON so previews can't be repurposed as-is.
    const job = await submitSeedanceJob({
      prompt,
      durationSeconds: 5,
      aspectRatio: '9:16',
      resolution: '480p',
      startImageUrl,
      enableAudio: false,
      engine: 'seedance-mini',
      watermark: true,
    })

    submitted = true

    return NextResponse.json({
      success: true,
      predictionId: job.predictionId,
      provider: 'seedance',
      product: {
        name: scraped.productName,
        image: scraped.productImageUrl,
        site: scraped.siteName,
      },
      note: 'Powered by Seedance Mini — our budget model at 480p. Subscribers get Seedance 2.0 & 2.5, 720p–4K, native audio, longer clips, and no watermark.',
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Preview generation failed',
    }, { status: 500 })
  } finally {
    if (!submitted) await releaseRateLimit('preview', ip)
  }
}
