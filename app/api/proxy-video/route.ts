// Same-origin video proxy for the browser-side editor export.
//
// The editor's canvas renderer must fetch() the source video (a plain
// <video src> works without CORS, but canvas capture taints unless the
// bytes come from a CORS-clean source). replicate.delivery and some CDNs
// don't send Access-Control-Allow-Origin for fetch, so the client falls
// back to this proxy — server-side fetch has no CORS restrictions and we
// return the bytes same-origin.
//
// Host-whitelisted to avoid being an open SSRF proxy; auth-required so it
// can't be hotlinked.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 120

const ALLOWED_HOSTS = [
  /(^|\.)replicate\.delivery$/,
  /(^|\.)supabase\.co$/,
  /(^|\.)replicate\.com$/,
]

export async function GET(request: NextRequest) {
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

  const url = request.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  let parsed: URL
  try { parsed = new URL(url) } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
  }
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.some(re => re.test(parsed.hostname))) {
    return NextResponse.json({ error: 'Host not allowed' }, { status: 403 })
  }

  const upstream = await fetch(url)
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: `Upstream fetch failed: ${upstream.status}. The source video may have expired.` },
      { status: 502 },
    )
  }

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'video/mp4',
      'Content-Length': upstream.headers.get('content-length') ?? '',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
