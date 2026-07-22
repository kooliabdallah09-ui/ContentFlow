// Fetches a brand website server-side, strips the HTML down to text +
// metadata, and lets Sonnet turn it into a filled brand profile — plus a
// logo URL when we can extract one. Powers the "Analyze my website" action
// in onboarding so users can skip typing every field.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 ContentFlow/1.0'

// Normalise any user-supplied URL — accept "example.com", "www.example.com",
// or a full https URL — and reject anything that isn't a real hostname.
function normaliseUrl(input: string): URL | null {
  let candidate = input.trim()
  if (!candidate) return null
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`
  try {
    const u = new URL(candidate)
    // Block private/local hosts so we can't be used as an SSRF proxy.
    const host = u.hostname.toLowerCase()
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.startsWith('127.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.')
    ) return null
    return u
  } catch { return null }
}

// Extract the important bits from an HTML page: title, meta description,
// og:*, headings, and a rough text digest of the first ~8k printable chars.
// Runs pure-string — no DOM parser dep needed for this shape of work.
function distillHtml(html: string, base: URL) {
  const pickMeta = (name: string) => {
    const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i')
    const m = html.match(re)
    return m?.[1]?.trim() ?? null
  }
  const pickMetaReverse = (name: string) => {
    const re = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["']${name}["']`, 'i')
    const m = html.match(re)
    return m?.[1]?.trim() ?? null
  }
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null
  const description = pickMeta('description') ?? pickMeta('og:description') ?? pickMeta('twitter:description') ?? pickMetaReverse('description')
  const ogTitle = pickMeta('og:title') ?? pickMeta('twitter:title')
  const ogImage = pickMeta('og:image') ?? pickMeta('twitter:image')
  const siteName = pickMeta('og:site_name') ?? pickMeta('application-name')

  // Headings — first 6 of each so Sonnet gets the copy pillars.
  const headings: string[] = []
  const h = html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)
  for (const m of h) {
    const text = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (text) headings.push(text)
    if (headings.length >= 8) break
  }

  // Visible body text — strip scripts, styles, and tags. Cheap but works.
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000)

  // Icon / logo hunt — resolve the highest-priority icon href relative to base.
  const iconMatches = [...html.matchAll(/<link[^>]+rel=["'](?:apple-touch-icon|icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/gi)]
  const iconHrefs = iconMatches.map(m => m[1])
  let iconUrl: string | null = null
  for (const href of iconHrefs) {
    try { iconUrl = new URL(href, base).toString(); break } catch {}
  }
  if (!iconUrl) {
    // Fallback: /favicon.ico at the site root.
    try { iconUrl = new URL('/favicon.ico', base).toString() } catch {}
  }
  let ogImageUrl: string | null = null
  if (ogImage) {
    try { ogImageUrl = new URL(ogImage, base).toString() } catch {}
  }
  return { title, description, ogTitle, ogImage: ogImageUrl, siteName, headings, body, iconUrl }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const url = normaliseUrl(String(body?.url ?? ''))
    if (!url) {
      return NextResponse.json({ error: 'Enter a valid website URL' }, { status: 400 })
    }

    // Fetch with a 15s timeout so a dead URL doesn't hang the request.
    let html = ''
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15_000)
      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
        signal: controller.signal,
        redirect: 'follow',
      })
      clearTimeout(timeout)
      if (!res.ok) {
        return NextResponse.json({ error: `Site returned ${res.status} — check the URL` }, { status: 400 })
      }
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('html')) {
        return NextResponse.json({ error: `Expected an HTML page, got ${ct || 'unknown content'}` }, { status: 400 })
      }
      html = await res.text()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Site could not be reached'
      return NextResponse.json({ error: `Couldn't reach the site — ${msg}` }, { status: 400 })
    }
    if (html.length < 400) {
      return NextResponse.json({ error: 'The site returned very little content — try a different URL' }, { status: 400 })
    }

    const distilled = distillHtml(html, url)

    // Ask Sonnet to turn the extracted content into the exact brand profile
    // shape the onboarding form already consumes. Same field names as the
    // /api/brand/ai-fill route so the client can reuse its handler.
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `You are analysing a brand's website to auto-fill their onboarding form. Below is the raw content extracted from ${url.toString()}. Turn it into a concrete, opinionated brand profile — no vague marketing speak, no filler. Every field must be answered from real signal in the content; if a field genuinely isn't inferable, use an empty string.

SITE TITLE: ${distilled.title ?? '(none)'}
OG TITLE: ${distilled.ogTitle ?? '(none)'}
META DESCRIPTION: ${distilled.description ?? '(none)'}
SITE NAME: ${distilled.siteName ?? '(none)'}

HEADINGS:
${distilled.headings.map(h => `- ${h}`).join('\n') || '(none)'}

BODY (first ~8k chars, tags stripped):
${distilled.body}

Return ONLY valid JSON (no markdown, no preamble) matching exactly this schema:
{
  "companyName": "the brand name as they present themselves — pull from title/og:title/site_name, prefer the shorter marketing name over any long tagline",
  "description": "2-3 sentences describing what the product is and who it's for, in the brand's own voice",
  "productType": "one of: physical product, digital product, service, SaaS, app, course, coaching",
  "uniqueValue": "one sentence — what makes this brand different from competitors, drawn from what they emphasise on the site",
  "brandMission": "one sentence mission — what the brand is trying to change or enable for its customers",
  "targetAudience": "one sentence — the specific customer they are speaking to (demographic + psychographic)",
  "customerPainPoints": "3-4 specific pain points the site addresses, comma-separated",
  "toneOfVoice": "one of: playful, authoritative, warm, edgy, minimal, luxurious, professional, conversational — inferred from the actual copy style",
  "brandColors": "up to 3 hex codes comma-separated (e.g. '#0F172A, #F97316') if you can infer them from mentions of brand colours or obvious accent hues in the copy — otherwise empty string"
}`,
      }],
    })
    const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim()
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '')
    let profile: Record<string, string>
    try { profile = JSON.parse(cleaned) } catch {
      console.error('[brand/analyze-site] JSON parse failed. Raw:', cleaned.slice(0, 500))
      return NextResponse.json({ error: 'Could not parse the site — try again or fill manually' }, { status: 500 })
    }

    // Try to grab the logo — prefer the biggest icon we found, fall back to
    // the og:image if the icon is a tiny favicon. Fetch it and upload to
    // Supabase so the onboarding form can preview it immediately.
    let logoUrl: string | null = null
    const candidates = [distilled.iconUrl, distilled.ogImage].filter((u): u is string => !!u)
    for (const src of candidates) {
      try {
        const controller = new AbortController()
        const t = setTimeout(() => controller.abort(), 6000)
        const r = await fetch(src, { headers: { 'User-Agent': UA }, signal: controller.signal })
        clearTimeout(t)
        if (!r.ok) continue
        const ct = r.headers.get('content-type') ?? 'image/png'
        if (!ct.startsWith('image/')) continue
        const buf = Buffer.from(await r.arrayBuffer())
        if (buf.length < 200 || buf.length > 3_000_000) continue
        const ext = ct.includes('svg') ? 'svg' : ct.includes('jpeg') ? 'jpg' : ct.includes('webp') ? 'webp' : ct.includes('ico') ? 'ico' : 'png'
        const path = `brand-logos/${userData.user.id}-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('ugc-assets').upload(path, buf, { contentType: ct, upsert: false })
        if (upErr) continue
        logoUrl = supabase.storage.from('ugc-assets').getPublicUrl(path).data.publicUrl
        break
      } catch { /* try the next candidate */ }
    }

    return NextResponse.json({ profile, logoUrl, sourceUrl: url.toString() })
  } catch (err) {
    console.error('brand/analyze-site error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    )
  }
}
