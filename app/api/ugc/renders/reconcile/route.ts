import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { reconcileRenders } from '@/lib/reconcile-renders'

// Resolve the signed-in user's own in-flight renders.
//
// This is what makes the feature work without a per-minute cron. Vercel's
// Hobby plan caps crons at two per project and once per day, so a `* * * * *`
// schedule is rejected at deploy time — the reconciler can't depend on it.
//
// The render watcher calls this whenever it sees something running, so a job
// completes as long as the app is open in any tab, on any page. The cron route
// still exists and sweeps every user, but it's now an optional backstop for
// "browser fully closed" rather than the mechanism.
//
// Scoped to the caller: userId comes from the verified token, never the body,
// so this can't be used to sweep (or refund) anyone else's renders.

export const maxDuration = 60

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

    // Small limit — one user won't have many in flight, and this runs on a
    // user-facing tick rather than a background sweep.
    const stats = await reconcileRenders(10, userData.user.id)
    return NextResponse.json({ ok: true, stats })
  } catch (err) {
    console.error('[renders/reconcile]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Reconcile failed' },
      { status: 500 },
    )
  }
}
