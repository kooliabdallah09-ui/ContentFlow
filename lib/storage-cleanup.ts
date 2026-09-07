// Supabase Storage janitor. Sweeps intermediate/transient files older than
// N days from the ugc-assets bucket, without touching anything a user can
// see or navigate to.
//
// Safe to delete (intermediate — never surfaced in the UI after use):
//   • preview-refs/     — /try product images, only used at submission
//   • preview-output/   — /try output videos, single-session
//   • video-ref/        — /generate/video reference frames
//   • hero-frames/      — Nano Banana keyframes; UGC output is a BytePlus URL,
//                         not the frame itself
//   • kling-source/     — legacy name for hero-frames (motion-broll pipeline)
//
// NEVER touched (user-visible content or long-lived assets):
//   • omni-output/      — admin Veo 3.1 videos in user libraries
//   • sora-output/      — legacy user videos from before migration
//   • demo/             — curated landing marquee assets
//   • anything else the code writes going forward, unless explicitly added
//
// Called by /api/cron/cleanup-storage on a daily Vercel Cron.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'ugc-assets'
const LIST_PAGE_SIZE = 1000     // Supabase max per list() call
const DELETE_BATCH_SIZE = 100   // Supabase remove() takes an array

export interface CleanupRule {
  prefix: string
  maxAgeDays: number
}

// Tune these when needed. Keep intermediate prefixes short, buffer for retries.
export const DEFAULT_RULES: CleanupRule[] = [
  { prefix: 'preview-refs',   maxAgeDays: 7  },
  { prefix: 'preview-output', maxAgeDays: 7  },
  { prefix: 'video-ref',      maxAgeDays: 14 },
  { prefix: 'hero-frames',    maxAgeDays: 30 },
  { prefix: 'kling-source',   maxAgeDays: 30 },
]

export interface PrefixStats {
  prefix: string
  scanned: number
  deleted: number
  skipped: number
  errors: number
  bytesFreed: number
}

export interface CleanupStats {
  ranAt: string
  durationMs: number
  perPrefix: PrefixStats[]
  totalDeleted: number
  totalBytesFreed: number
}

function getClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

// Sweep one prefix. Paginates the list, filters by age, batches deletes.
async function cleanupPrefix(
  supabase: SupabaseClient,
  rule: CleanupRule,
): Promise<PrefixStats> {
  const stats: PrefixStats = {
    prefix: rule.prefix,
    scanned: 0,
    deleted: 0,
    skipped: 0,
    errors: 0,
    bytesFreed: 0,
  }
  const cutoffMs = Date.now() - rule.maxAgeDays * 24 * 60 * 60 * 1000
  const toDelete: string[] = []
  let bytesPending = 0

  let offset = 0
  // Loop until list() returns fewer items than we asked for.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(rule.prefix, {
        limit: LIST_PAGE_SIZE,
        offset,
        sortBy: { column: 'created_at', order: 'asc' },
      })

    if (error) {
      console.error(`[storage-cleanup] list error for ${rule.prefix}:`, error.message)
      stats.errors++
      break
    }
    if (!data || data.length === 0) break

    for (const item of data) {
      stats.scanned++
      // Folders (no id, no metadata) are skipped.
      if (!item.name || item.name === '.emptyFolderPlaceholder') { stats.skipped++; continue }
      // Supabase returns created_at as ISO string on File items.
      const createdAt = item.created_at ? new Date(item.created_at).getTime() : NaN
      if (!Number.isFinite(createdAt)) { stats.skipped++; continue }
      if (createdAt > cutoffMs) { stats.skipped++; continue }

      const size = (item.metadata as { size?: number } | null)?.size ?? 0
      toDelete.push(`${rule.prefix}/${item.name}`)
      bytesPending += size
    }

    if (data.length < LIST_PAGE_SIZE) break
    offset += LIST_PAGE_SIZE
  }

  // Delete in batches — remove() takes an array.
  for (let i = 0; i < toDelete.length; i += DELETE_BATCH_SIZE) {
    const batch = toDelete.slice(i, i + DELETE_BATCH_SIZE)
    const { error } = await supabase.storage.from(BUCKET).remove(batch)
    if (error) {
      console.error(`[storage-cleanup] delete error in ${rule.prefix}:`, error.message)
      stats.errors++
      continue
    }
    stats.deleted += batch.length
  }
  stats.bytesFreed = stats.deleted === toDelete.length ? bytesPending : 0
  return stats
}

export async function cleanupOldStorage(
  rules: CleanupRule[] = DEFAULT_RULES,
): Promise<CleanupStats> {
  const start = Date.now()
  const supabase = getClient()
  const perPrefix: PrefixStats[] = []
  for (const rule of rules) {
    try {
      const stats = await cleanupPrefix(supabase, rule)
      perPrefix.push(stats)
    } catch (e) {
      console.error(`[storage-cleanup] fatal for ${rule.prefix}:`, e)
      perPrefix.push({
        prefix: rule.prefix,
        scanned: 0, deleted: 0, skipped: 0, errors: 1, bytesFreed: 0,
      })
    }
  }
  return {
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    perPrefix,
    totalDeleted: perPrefix.reduce((n, p) => n + p.deleted, 0),
    totalBytesFreed: perPrefix.reduce((n, p) => n + p.bytesFreed, 0),
  }
}
