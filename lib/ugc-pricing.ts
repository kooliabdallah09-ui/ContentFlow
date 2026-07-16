// Single source of truth for UGC package pricing. Kept in sync between the
// client-side cost card (UGCPackageBuilder) and the server-side deduction
// (app/api/ugc/animate/route.ts).
//
// Costs are computed at 1 credit = $0.024. All raw costs multiplied by
// 1.8x for margin and rounded up.
//
// Real cost breakdown for a typical 10s 1080p UGC package:
//   - Nano Banana Pro × 4 hero frames        $0.60
//   - Nano Banana Pro × 1 product refinement $0.15
//   - Claude Sonnet script + prompt calls    ~$0.05
//   - Seedance 2.0 1080p × 10s with audio    $4.50
//   ─────────────────────────────────────────────
//   raw total                                $5.30
//   × 1.8 margin                             $9.54  → 398 credits

export type UGCResolution = '480p' | '720p' | '1080p' | '4k'

// Seedance 2.0 non_video_in rates × 1.8 markup, rounded up, per second.
export const SEEDANCE_CR_PER_SECOND: Record<UGCResolution, number> = {
  '480p': 6,     // $0.08/s
  '720p': 13,    // $0.18/s
  '1080p': 33,   // $0.45/s
  '4k':   72,    // $1.00/s
}

// Fixed overhead per package: Nano Banana Pro renders + Claude prompt calls.
// 4 hero frames + 1 refinement × $0.15 = $0.75, plus ~$0.05 in Claude calls
// → $0.80 × 1.8 margin ≈ $1.44 → 60 credits (round up).
export const UGC_FIXED_OVERHEAD_CR = 60

export function ugcPackageCost(durationSeconds: number, resolution: UGCResolution): number {
  const perSec = SEEDANCE_CR_PER_SECOND[resolution] ?? SEEDANCE_CR_PER_SECOND['1080p']
  const videoCost = Math.max(1, Math.ceil(durationSeconds * perSec))
  return UGC_FIXED_OVERHEAD_CR + videoCost
}
