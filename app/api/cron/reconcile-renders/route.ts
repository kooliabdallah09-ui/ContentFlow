import { NextRequest, NextResponse } from 'next/server'
import { reconcileRenders } from '@/lib/reconcile-renders'

// Optional backstop. Finishes renders whose browser navigated away
// mid-generation, and refunds the ones that failed. See
// lib/reconcile-renders.ts for the resolution rules.
//
// NOT wired into vercel.json, on purpose: the Hobby plan caps crons at two per
// project and once per day, and rejects a sub-daily schedule at deploy time.
// The primary path is /api/ugc/renders/reconcile, which the render watcher
// calls while the app is open — that covers everything except "browser closed
// entirely before the render finished", which resolves on next visit anyway.
//
// On Pro, add this back for renders that finish with nobody watching:
//   { "path": "/api/cron/reconcile-renders", "schedule": "* * * * *" }
//
// Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET
// is set in the project env. Any other caller must present the same secret.

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const stats = await reconcileRenders()
    if (stats.scanned > 0) console.log('[cron/reconcile-renders]', JSON.stringify(stats))
    return NextResponse.json({ ok: true, stats })
  } catch (err) {
    console.error('[cron/reconcile-renders] failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Reconcile failed' },
      { status: 500 },
    )
  }
}
