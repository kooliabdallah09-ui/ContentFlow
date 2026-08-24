// Visit ingestion endpoint. Client fires a fetch to this on every pageview
// (except /admin, /api, static assets — filtered client-side in VisitTracker).
// We read the visitor's IP + geo from Vercel's edge headers, parse the UA,
// and insert one row into page_visits via the service-role key.
//
// Fire-and-forget from the client: we always return 204 quickly so a slow
// insert doesn't block the page. Errors are logged, never surfaced.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// Bot filter — skip obvious crawlers so the panel shows real humans.
const BOT_UA_RE = /bot|crawler|spider|slurp|mediapartners|facebookexternalhit|preview|whatsapp|telegram|discordbot|semrush|ahrefs|screaming/i

// Very small user-agent parser. We don't need full accuracy — just enough
// to display "Mac · Chrome" in the table. Order matters (more specific first).
function parseUA(ua: string): { device: string; browser: string } {
  const s = ua.toLowerCase()
  let device = 'Unknown'
  if (/iphone|ipod/.test(s)) device = 'iPhone'
  else if (/ipad/.test(s)) device = 'iPad'
  else if (/android/.test(s)) device = 'Android'
  else if (/macintosh|mac os x/.test(s)) device = 'Mac'
  else if (/windows/.test(s)) device = 'Windows'
  else if (/linux/.test(s)) device = 'Linux'
  let browser = 'Unknown'
  if (/edg\//.test(s)) browser = 'Edge'
  else if (/opr\/|opera/.test(s)) browser = 'Opera'
  else if (/chrome\//.test(s) && !/edg\/|opr\//.test(s)) browser = 'Chrome'
  else if (/firefox/.test(s)) browser = 'Firefox'
  else if (/safari/.test(s) && !/chrome\//.test(s)) browser = 'Safari'
  return { device, browser }
}

export async function POST(request: NextRequest) {
  try {
    const ua = request.headers.get('user-agent') ?? ''
    if (!ua || BOT_UA_RE.test(ua)) {
      return new NextResponse(null, { status: 204 })
    }

    const body = await request.json().catch(() => ({}))
    const path = typeof body?.path === 'string' ? body.path.slice(0, 500) : null
    if (!path) return new NextResponse(null, { status: 204 })

    // Filter admin/api/static paths server-side too — defence in depth in
    // case a client sends something the filter would normally block.
    if (path.startsWith('/admin') || path.startsWith('/api') || path.startsWith('/_next')) {
      return new NextResponse(null, { status: 204 })
    }

    const referrer = typeof body?.referrer === 'string' ? body.referrer.slice(0, 500) : null

    // Vercel edge auto-adds these headers on prod deployments. Locally they
    // won't exist so ip/country/city fall through to null.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || null
    const country = request.headers.get('x-vercel-ip-country') || null
    const city = request.headers.get('x-vercel-ip-city') || null

    const { device, browser } = parseUA(ua)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) return new NextResponse(null, { status: 204 })
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fire-and-forget insert. We don't await the response beyond queuing the
    // row so the client sees a fast 204.
    await supabase.from('page_visits').insert({
      ip, path, referrer, user_agent: ua.slice(0, 500),
      country, city, device, browser,
    })
  } catch (e) {
    console.error('[track/visit] insert failed:', e)
  }
  return new NextResponse(null, { status: 204 })
}
