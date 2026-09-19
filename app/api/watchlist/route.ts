import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// The competitor ad watchlist — list and add.
//
// Adding stores the teardown alongside the ad so "make my version" later
// doesn't have to re-analyse (and re-pay for) an ad already broken down.

const MAX_WATCHED = 100

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function userFrom(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const supabase = svc()
  const { data } = await supabase.auth.getUser(authHeader.slice(7))
  return data.user ? { supabase, userId: data.user.id } : null
}

export async function GET(request: NextRequest) {
  try {
    const auth = await userFrom(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await auth.supabase
      .from('user_watched_ads')
      .select('id, competitor, platform, source_url, teardown, thumb_url, first_seen_at, last_confirmed_at, died_at, check_count, notes, created_at')
      .eq('user_id', auth.userId)
      // Live ads first, then longest-running — the ones worth copying float up.
      .order('died_at', { ascending: true, nullsFirst: true })
      .order('first_seen_at', { ascending: true })
      .limit(MAX_WATCHED)

    if (error) throw new Error(error.message)
    return NextResponse.json({ ads: data ?? [] })
  } catch (err) {
    console.error('[watchlist] list', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load watchlist' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await userFrom(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const competitor = typeof body.competitor === 'string' ? body.competitor.trim().slice(0, 120) : ''
    const teardown = body.teardown
    if (!competitor) {
      return NextResponse.json({ error: 'Which brand is this ad from?' }, { status: 400 })
    }
    if (!teardown || typeof teardown !== 'object') {
      return NextResponse.json({ error: 'A teardown is required' }, { status: 400 })
    }

    const { count } = await auth.supabase
      .from('user_watched_ads')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.userId)
    if ((count ?? 0) >= MAX_WATCHED) {
      return NextResponse.json(
        { error: `Watchlist is full (${MAX_WATCHED}). Remove one first.` },
        { status: 409 },
      )
    }

    const { data, error } = await auth.supabase
      .from('user_watched_ads')
      .insert({
        user_id: auth.userId,
        competitor,
        platform: ['meta', 'tiktok', 'other'].includes(body.platform) ? body.platform : 'meta',
        source_url: typeof body.sourceUrl === 'string' ? body.sourceUrl.slice(0, 1000) : null,
        teardown,
        thumb_url: typeof body.thumbUrl === 'string' ? body.thumbUrl.slice(0, 1000) : null,
        notes: typeof body.notes === 'string' ? body.notes.slice(0, 2000) : null,
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (err) {
    console.error('[watchlist] add', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save' },
      { status: 500 },
    )
  }
}
