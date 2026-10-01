import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'

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

  let html = ''
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ContentFlow/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(timeout)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const raw = await res.text()
    // Strip scripts, styles, and HTML tags; keep readable text, limit size
    html = raw
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 6000)
  } catch {
    return NextResponse.json({ error: 'Could not fetch the URL. Make sure it is a public product page.' }, { status: 422 })
  }

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
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: 'Could not extract product info from this page.' }, { status: 422 })
  }
}
