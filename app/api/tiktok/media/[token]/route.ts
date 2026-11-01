import { NextRequest, NextResponse } from 'next/server'
import { readToken } from '@/lib/oauth-state'
import { adminDb } from '@/lib/integrations/tiktok'

export const maxDuration = 120

// TikTok's PULL_FROM_URL fetches the video from here (our verified domain).
// Access is by a signed, 1-hour token issued in /api/tiktok/post, so no
// session is needed and the link can't be guessed or reused later.
const ALLOWED_HOSTS = [/(^|\.)supabase\.co$/, /(^|\.)replicate\.delivery$/]

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const t = readToken<{ c?: string; u?: string }>(token)
  if (!t?.c || !t.u) return NextResponse.json({ error: 'Link expired' }, { status: 403 })

  const { data: item } = await adminDb().from('ugc_content')
    .select('storage_url, status').eq('id', t.c).eq('user_id', t.u).maybeSingle()
  if (!item || item.status !== 'completed') return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let src: URL
  try { src = new URL(item.storage_url) } catch { return NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  if (src.protocol !== 'https:' || !ALLOWED_HOSTS.some(re => re.test(src.hostname))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const range = req.headers.get('range')
  const upstream = await fetch(src, { headers: range ? { range } : {} })
  if (!upstream.ok || !upstream.body) return NextResponse.json({ error: 'Video unavailable' }, { status: 502 })

  const headers = new Headers({ 'Content-Type': upstream.headers.get('content-type') ?? 'video/mp4', 'Cache-Control': 'private, no-store' })
  for (const h of ['content-length', 'content-range', 'accept-ranges']) {
    const v = upstream.headers.get(h)
    if (v) headers.set(h, v)
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers })
}
