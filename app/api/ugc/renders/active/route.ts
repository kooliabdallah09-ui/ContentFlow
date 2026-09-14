import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Recent renders and their current state, for the global render watcher.
//
// Deliberately selects only columns that predate migration 018. The watcher
// spots a finished render by diffing statuses between polls rather than reading
// completed_at, so this endpoint keeps working whether or not 018 has been
// applied — the library route carries a comment about a past outage caused by
// selecting a column that wasn't on every environment's schema yet.

export async function GET(request: NextRequest) {
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

    // A couple of hours is enough to catch anything that finished while the
    // user was on another page, without dragging the whole history along.
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('ugc_content')
      .select('id, status, metadata, credit_cost, created_at')
      .eq('user_id', userData.user.id)
      .eq('content_type', 'video')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(25)

    if (error) {
      console.error('[renders/active]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const renders = (data ?? []).map(r => ({
      id: r.id,
      status: r.status as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      productName: ((r.metadata as any)?.productName as string) ?? 'your ad',
      creditCost: Number(r.credit_cost) || 0,
      createdAt: r.created_at as string,
    }))

    return NextResponse.json({
      renders,
      running: renders.filter(r => r.status === 'generating').length,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    )
  }
}
