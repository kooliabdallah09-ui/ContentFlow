// Finishes renders whose browser walked away.
//
// /api/ugc/animate deducts credits, submits the job, and hands the provider's
// task id back to the client. Until now that id only existed in React state —
// a page navigation dropped it, the provider finished the render anyway, and
// nobody ever collected the result. Credits spent, video orphaned.
//
// This sweeps ugc_content for renders still marked `generating` that carry a
// provider job id, polls the provider, and resolves them:
//   succeeded → status `completed`, video url written into storage_url
//   failed    → status `failed`, credits refunded
//
// It runs on a schedule (see vercel.json) so a render completes whether or not
// anyone is watching. Webhooks would cut the latency, but this has to exist
// regardless as the backstop for missed deliveries — so it comes first.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSeedanceStatus } from '@/lib/seedance'
import { getStitchStatus } from '@/lib/shotstack'
import { addCredits } from '@/lib/credits'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = SupabaseClient<any, 'public', any>

// How long a render may sit unresolved before we stop polling and refund it.
// Seedance jobs finish in ~2 min; 45 is generous enough that a slow queue isn't
// mistaken for a failure.
const STALE_AFTER_MINUTES = 45

// Spacing between polls, by attempt. Fast at first (most jobs land in the first
// couple of minutes), then backing off so a stuck job doesn't dominate a run.
function nextPollDelayMs(attempts: number): number {
  if (attempts < 4) return 30_000
  if (attempts < 10) return 60_000
  return 180_000
}

export interface ReconcileStats {
  scanned: number
  completed: number
  failed: number
  refunded: number
  refundedCredits: number
  stillRunning: number
  errors: number
}

interface PendingRow {
  id: string
  user_id: string
  provider: string | null
  provider_job_id: string | null
  storage_url: string | null
  credit_cost: number | null
  poll_attempts: number | null
  created_at: string
  refunded_at: string | null
}

function svc(): Supa {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** Poll one provider for a job's current state. */
async function pollProvider(
  provider: string | null,
  jobId: string,
): Promise<{ status: 'pending' | 'completed' | 'failed'; videoUrl?: string; error?: string }> {
  if (provider === 'shotstack') {
    const r = await getStitchStatus(jobId)
    if (r.status === 'succeeded') return { status: 'completed', videoUrl: r.url }
    if (r.status === 'failed') return { status: 'failed', error: r.error }
    return { status: 'pending' }
  }
  // Default to Seedance — it's what /api/ugc/animate submits.
  const r = await getSeedanceStatus(jobId)
  if (r.status === 'completed') return { status: 'completed', videoUrl: r.videoUrl }
  if (r.status === 'failed') return { status: 'failed', error: r.error }
  return { status: 'pending' }
}

/**
 * Merge the finished video URL into the stored components blob.
 *
 * storage_url holds a JSON string of the whole component set (script, audio,
 * video...), so the video URL has to be threaded into it rather than replacing
 * it — overwriting would drop the script and audio the client renders from.
 */
function withVideoUrl(storageUrl: string | null, videoUrl: string): string {
  try {
    const parsed = storageUrl ? JSON.parse(storageUrl) : {}
    return JSON.stringify({
      ...parsed,
      video: { ...(parsed.video ?? {}), videoUrl, status: 'completed' },
    })
  } catch {
    // storage_url wasn't JSON (older rows stored a bare URL) — start clean
    // rather than throwing away the result we just collected.
    return JSON.stringify({ video: { videoUrl, status: 'completed' } })
  }
}

/**
 * Refund a failed render, exactly once.
 *
 * The refunded_at guard is what makes this safe to re-run: a sweeper that
 * crashes after crediting but before writing status would otherwise refund the
 * same render on its next pass.
 */
async function refundOnce(supabase: Supa, row: PendingRow, reason: string): Promise<number> {
  const cost = Number(row.credit_cost) || 0
  if (cost <= 0 || row.refunded_at) return 0

  // Claim the refund first. If another run already claimed it, this matches no
  // rows and we credit nothing.
  const { data: claimed } = await supabase
    .from('ugc_content')
    .update({ refunded_at: new Date().toISOString() })
    .eq('id', row.id)
    .is('refunded_at', null)
    .select('id')

  if (!claimed?.length) return 0

  try {
    await addCredits(row.user_id, cost, 'refund', `Refund — render failed (${reason})`)
    return cost
  } catch (err) {
    // Release the claim so a later run can retry the credit.
    await supabase.from('ugc_content').update({ refunded_at: null }).eq('id', row.id)
    throw err
  }
}

export async function reconcileRenders(limit = 40): Promise<ReconcileStats> {
  const supabase = svc()
  const stats: ReconcileStats = {
    scanned: 0, completed: 0, failed: 0,
    refunded: 0, refundedCredits: 0, stillRunning: 0, errors: 0,
  }

  const nowIso = new Date().toISOString()
  const { data: rows, error } = await supabase
    .from('ugc_content')
    .select('id, user_id, provider, provider_job_id, storage_url, credit_cost, poll_attempts, created_at, refunded_at')
    .eq('status', 'generating')
    .not('provider_job_id', 'is', null)
    .or(`poll_after.is.null,poll_after.lte.${nowIso}`)
    .order('poll_after', { ascending: true, nullsFirst: true })
    .limit(limit)

  if (error) throw new Error(`reconcile query failed: ${error.message}`)

  for (const row of (rows ?? []) as PendingRow[]) {
    stats.scanned++
    const attempts = (row.poll_attempts ?? 0) + 1
    const ageMin = (Date.now() - new Date(row.created_at).getTime()) / 60_000

    try {
      const result = await pollProvider(row.provider, row.provider_job_id!)

      if (result.status === 'completed' && result.videoUrl) {
        await supabase.from('ugc_content').update({
          status: 'completed',
          storage_url: withVideoUrl(row.storage_url, result.videoUrl),
          completed_at: new Date().toISOString(),
          poll_attempts: attempts,
        }).eq('id', row.id)
        stats.completed++
        continue
      }

      if (result.status === 'failed') {
        const credited = await refundOnce(supabase, row, result.error ?? 'provider reported failure')
        await supabase.from('ugc_content').update({
          status: 'failed',
          failure_reason: (result.error ?? 'provider reported failure').slice(0, 500),
          completed_at: new Date().toISOString(),
          poll_attempts: attempts,
        }).eq('id', row.id)
        stats.failed++
        if (credited > 0) { stats.refunded++; stats.refundedCredits += credited }
        continue
      }

      // Still running. Give up once it's clearly never landing — an unresolved
      // render the user already paid for is worse than a refunded one.
      if (ageMin > STALE_AFTER_MINUTES) {
        const reason = `no result after ${Math.round(ageMin)} minutes`
        const credited = await refundOnce(supabase, row, reason)
        await supabase.from('ugc_content').update({
          status: 'failed',
          failure_reason: reason,
          completed_at: new Date().toISOString(),
          poll_attempts: attempts,
        }).eq('id', row.id)
        stats.failed++
        if (credited > 0) { stats.refunded++; stats.refundedCredits += credited }
        continue
      }

      await supabase.from('ugc_content').update({
        poll_attempts: attempts,
        poll_after: new Date(Date.now() + nextPollDelayMs(attempts)).toISOString(),
      }).eq('id', row.id)
      stats.stillRunning++
    } catch (err) {
      // A provider hiccup shouldn't fail the whole sweep or burn the row —
      // back it off and let the next run retry.
      stats.errors++
      console.warn('[reconcile] poll failed', row.id, err instanceof Error ? err.message : err)
      await supabase.from('ugc_content').update({
        poll_attempts: attempts,
        poll_after: new Date(Date.now() + nextPollDelayMs(attempts)).toISOString(),
      }).eq('id', row.id)
    }
  }

  return stats
}
