import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { scrapeProductUrl } from '@/lib/preview-scraper'
import { submitSeedanceJob } from '@/lib/seedance'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

// In-memory IP rate limit. Vercel serverless instances don't share memory,
// so worst-case a determined user gets 2-3 previews per day. Acceptable at
// ~$0.20 raw cost per preview. Upgrade to Vercel KV if abuse becomes real.
const RATE_LIMIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000  // 7 days
const previewLog = new Map<string, number>()

function getIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function checkRateLimit(ip: string): { ok: boolean; retryAfterHours?: number } {
  const now = Date.now()
  // Sweep expired entries occasionally to keep the map bounded.
  if (previewLog.size > 5000) {
    for (const [k, t] of previewLog) if (now - t > RATE_LIMIT_WINDOW_MS) previewLog.delete(k)
  }
  const last = previewLog.get(ip)
  if (last && now - last < RATE_LIMIT_WINDOW_MS) {
    return { ok: false, retryAfterHours: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - last)) / (60 * 60 * 1000)) }
  }
  return { ok: true }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getIp(request)
    const limit = checkRateLimit(ip)
    if (!limit.ok) {
      const hours = limit.retryAfterHours ?? 0
      const wait = hours >= 24 ? `${Math.ceil(hours / 24)} day${Math.ceil(hours / 24) === 1 ? '' : 's'}` : `${hours}h`
      return NextResponse.json({
        error: `You've already generated your free preview this week. Sign up for unlimited generations, or come back in ${wait}.`,
        code: 'rate_limited',
      }, { status: 429 })
    }

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

    // Only record the successful submission — errors above don't burn the daily slot.
    previewLog.set(ip, Date.now())

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
  }
}
