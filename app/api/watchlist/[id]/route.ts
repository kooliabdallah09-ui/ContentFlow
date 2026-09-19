import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Confirm an ad is still running, mark it gone, or drop it from the watchlist.
//
// "Still running?" is the whole product: each confirmation extends the ad's
// measured lifetime, and lifetime is the performance signal.

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await userFrom(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const body = await request.json().catch(() => ({}))
    const now = new Date().toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = { last_confirmed_at: now }

    if (body.status === 'live') {
      // Re-confirming resurrects an ad marked dead by mistake.
      patch.died_at = null
    } else if (body.status === 'dead') {
      patch.died_at = now
    }
    if (typeof body.notes === 'string') patch.notes = body.notes.slice(0, 2000)

    // Read the current count rather than trusting the client with it.
    const { data: existing } = await auth.supabase
      .from('user_watched_ads')
      .select('check_count')
      .eq('id', id)
      .eq('user_id', auth.userId)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    patch.check_count = (existing.check_count ?? 0) + 1

    const { data, error } = await auth.supabase
      .from('user_watched_ads')
      .update(patch)
      .eq('id', id)
      .eq('user_id', auth.userId)
      .select('id, first_seen_at, died_at, last_confirmed_at, check_count')
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ ad: data })
  } catch (err) {
    console.error('[watchlist] patch', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Update failed' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await userFrom(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const { error } = await auth.supabase
      .from('user_watched_ads')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.userId)

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 500 },
    )
  }
}
