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
export type UGCEngine = 'seedance-2' | 'seedance-mini' | 'omni-flash'

// Seedance 2.0 non_video_in rates × 1.8 markup, rounded up, per second.
export const SEEDANCE_CR_PER_SECOND: Record<UGCResolution, number> = {
  '480p': 6,     // $0.08/s
  '720p': 13,    // $0.18/s
  '1080p': 33,   // $0.45/s
  '4k':   72,    // $1.00/s
}

// Seedance 2.0 Mini — same architecture at about half the per-second cost,
// capped at 720p. non_video_in: 480p $0.04/s, 720p $0.09/s → × 1.8 markup.
export const SEEDANCE_MINI_CR_PER_SECOND: Record<'480p' | '720p', number> = {
  '480p': 3,     // $0.04/s → $0.072 → 3 cr
  '720p': 7,     // $0.09/s → $0.162 → 6.75 → 7 cr
}

// Veo 3.1 Fast on Vertex — admin-only. Priced against Google's public
// Vertex rates for Veo 3.1 Fast ($0.40/s at 720p, $0.65/s at 1080p) with
// our 1.8× markup applied.
export const OMNI_FLASH_CR_PER_SECOND: Record<'720p' | '1080p', number> = {
  '720p': 12,   // $0.40/s × 1.8 ≈ $0.72 → 12 cr
  '1080p': 20,  // $0.65/s × 1.8 ≈ $1.17 → 20 cr
}

// Fixed overhead per package: Nano Banana Pro renders + Claude prompt calls.
// 4 hero frames + 1 refinement × $0.15 = $0.75, plus ~$0.05 in Claude calls
// → $0.80 × 1.8 margin ≈ $1.44 → 60 credits (round up).
export const UGC_FIXED_OVERHEAD_CR = 60

// Volume discount on the video portion — longer clips get a proportionally
// cheaper per-second rate. Margin at the deepest tier is still 1.8 × 0.75 =
// 1.35× over raw Seedance cost.
export function durationDiscount(durationSeconds: number): number {
  if (durationSeconds <= 5) return 1.0
  if (durationSeconds <= 10) return 0.95
  if (durationSeconds <= 15) return 0.9
  if (durationSeconds <= 20) return 0.85
  if (durationSeconds <= 30) return 0.8
  return 0.75
}

export function ugcPackageCost(
  durationSeconds: number,
  resolution: UGCResolution,
  engine: UGCEngine = 'seedance-2',
): number {
  let perSec: number
  if (engine === 'seedance-mini') {
    // Mini caps at 720p — higher resolutions bill (and render) as 720p.
    const res = resolution === '480p' ? '480p' : '720p'
    perSec = SEEDANCE_MINI_CR_PER_SECOND[res]
  } else if (engine === 'omni-flash') {
    // Omni Flash only offers 720p or 1080p — snap other resolutions.
    const res = resolution === '1080p' ? '1080p' : '720p'
    perSec = OMNI_FLASH_CR_PER_SECOND[res]
  } else {
    perSec = SEEDANCE_CR_PER_SECOND[resolution] ?? SEEDANCE_CR_PER_SECOND['1080p']
  }
  const videoCost = Math.max(1, Math.ceil(durationSeconds * perSec * durationDiscount(durationSeconds)))
  return UGC_FIXED_OVERHEAD_CR + videoCost
}
