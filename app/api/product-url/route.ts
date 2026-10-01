import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'
import { extractBrand } from '@/lib/brand-assets'

export const maxDuration = 30

// Fetches a page server-side and spends a Haiku call on it, so it needs a
// signed-in user, a rate limit, and a public http(s) target: no localhost,
// internal hostnames or private IP ranges.
function isPublicHttpUrl(raw: string): boolean {
  let u: URL
  try { u = new URL(raw) } catch { return false }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!h.includes('.') || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return false
  const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return false
  }
  if (h.includes(':')) return false // IPv6 literals: none of our users need them
  return true
}

const UA = 'Mozilla/5.0 (compatible; ContentFlow/1.0)'

// Downloads a public URL. Every redirect hop is re-checked (a public page
// must not be able to bounce us to an internal address), the whole request
// including the body is bounded by the timeout, and a body over maxBytes is
// cut off (truncate) or refused. Returns null on any failure.
async function fetchBytes(startUrl: string, accept: string, maxBytes: number, timeoutMs: number, truncate: boolean) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let url = startUrl
    for (let hop = 0; hop <= 3; hop++) {
      if (!isPublicHttpUrl(url)) return null
      const res = await fetch(url, { signal: controller.signal, redirect: 'manual', headers: { 'User-Agent': UA, Accept: accept } })
      const location = res.headers.get('location')
      if (res.status >= 300 && res.status < 400 && location) {
        url = new URL(location, url).toString()
        await res.body?.cancel()
        continue
      }
      if (!res.ok || !res.body) return null
      const chunks: Uint8Array[] = []
      let size = 0
      const reader = res.body.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > maxBytes && !truncate) { await reader.cancel(); return null }
        chunks.push(value)
        if (size > maxBytes) { await reader.cancel(); break }
      }
      return { bytes: Buffer.concat(chunks).subarray(0, maxBytes), type: (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase(), url }
    }
    return null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// The browser can't download these itself (most CDNs send no CORS headers),
// so they travel back inside the JSON as data URLs. Capped so both fit in
// Vercel's 4.5 MB response limit.
async function firstImage(urls: string[], maxBytes: number): Promise<string | null> {
  for (const u of urls) {
    const f = await fetchBytes(u, 'image/*', maxBytes, 5000, false)
    if (f && /^image\/(png|jpe?g|webp|gif)$/.test(f.type)) return `data:${f.type};base64,${f.bytes.toString('base64')}`
  }
  return null
}

async function importBrand(html: string, pageUrl: string) {
  const found = extractBrand(html, pageUrl)
  const [image, logo] = await Promise.all([firstImage(found.images, 2_000_000), firstImage(found.logos, 500_000)])
  return { image, logo, colors: found.colors }
}

export async function GET(request: NextRequest) {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: userData } = await supabase.auth.getUser(header.slice(7))
  if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = request.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'Missing url param' }, { status: 400 })
  if (!isPublicHttpUrl(url)) return NextResponse.json({ error: 'Enter a public website address (https://…)' }, { status: 400 })

  const limit = await checkRateLimit('product-url', userData.user.id, 30, 3600 * 1000)
  if (!limit.ok) return NextResponse.json({ error: 'Too many lookups, try again in a bit' }, { status: 429 })

  const page = await fetchBytes(url, 'text/html,application/xhtml+xml', 800_000, 8000, true)
  if (!page) return NextResponse.json({ error: 'Could not fetch the URL. Make sure it is a public product page.' }, { status: 422 })
  const pageHtml = page.bytes.toString('utf8')
  // Strip scripts, styles, and HTML tags; keep readable text, limit size
  const html = pageHtml
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 6000)

  // Motion Ads asks for the brand's imagery too (?brand=1); it runs alongside the Haiku call.
  const brand = request.nextUrl.searchParams.get('brand') === '1' ? importBrand(pageHtml, page.url).catch(() => null) : null

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `Extract product info from this webpage text and return ONLY valid JSON (no markdown, no backticks):\n\n${html}\n\nReturn this exact shape:\n{"productName":"...","productDescription":"1-2 sentence description","benefits":"benefit 1\\nbenefit 2\\nbenefit 3","callToAction":"Shop now","price":""}`,
      },
    ],
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
  try {
    const jsonStart = raw.indexOf('{')
    const jsonEnd = raw.lastIndexOf('}')
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
    return NextResponse.json(brand ? { ...parsed, brand: await brand } : parsed)
  } catch {
    return NextResponse.json({ error: 'Could not extract product info from this page.' }, { status: 422 })
  }
}
