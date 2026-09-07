import { NextRequest, NextResponse } from 'next/server'
import { cleanupOldStorage } from '@/lib/storage-cleanup'

// Runs daily via Vercel Cron (see vercel.json). Deletes intermediate/transient
// files older than N days from the ugc-assets bucket. See lib/storage-cleanup.ts
// for the rules and the guarantees on what is NEVER deleted.
//
// Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET
// is set in the project env. Any other caller must present the same secret.

export const maxDuration = 300  // Vercel Pro allows up to 300s for serverless

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const stats = await cleanupOldStorage()
    console.log('[cron/cleanup-storage] done', JSON.stringify(stats))
    return NextResponse.json({ ok: true, stats })
  } catch (error) {
    console.error('[cron/cleanup-storage] failed', error)
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Cleanup failed',
    }, { status: 500 })
  }
}
