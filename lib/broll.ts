// Product B-roll cutaway selection.
//
// Where the cutaway lands matters more than what's in it. A cutaway during the
// hook throws away the only second that decides whether anyone keeps watching;
// a cutaway over the CTA hides the ask. So it belongs in the middle — after the
// hook has landed, before the close.

import type { KenBurnsMotion } from '@/lib/shotstack'

// Fraction of the way through the ad where a cutaway reads naturally.
const CUTAWAY_WINDOW = { start: 0.34, end: 0.62 }

export const DEFAULT_CUTAWAY_SECONDS = 1.5

// Below this there's no room for a cutaway that both reads as a cut and still
// leaves the talking head on screen. Clamping into a shorter clip just pushes
// the overlay past the end of the video and leaves a black tail.
export const MIN_CUTAWAY_VIDEO_SECONDS = 2.5

export function canCutaway(videoDuration: number): boolean {
  return Number.isFinite(videoDuration) && videoDuration >= MIN_CUTAWAY_VIDEO_SECONDS
}

/**
 * Pick when to cut away.
 *
 * With script beats we land on the first beat boundary inside the window —
 * cutting on a sentence break instead of mid-word. Without them we fall back
 * to a fixed fraction of the runtime.
 */
export function pickCutawayTime(
  videoDuration: number,
  opts: { beatBoundaries?: number[]; cutawayDuration?: number } = {},
): number {
  const dur = videoDuration > 0 ? videoDuration : 12
  const clip = opts.cutawayDuration ?? DEFAULT_CUTAWAY_SECONDS
  const lo = dur * CUTAWAY_WINDOW.start
  const hi = Math.min(dur * CUTAWAY_WINDOW.end, Math.max(dur - clip - 0.2, lo))

  const boundaries = (opts.beatBoundaries ?? [])
    .filter(t => Number.isFinite(t) && t >= lo && t <= hi)
    .sort((a, b) => a - b)

  if (boundaries.length > 0) return boundaries[0]
  return Math.max(lo, Math.min(hi, dur * 0.4))
}

/**
 * How long the cutaway should hold. Short ads get a shorter cut so the
 * cutaway never dominates — never more than a quarter of the runtime.
 */
export function pickCutawayDuration(videoDuration: number): number {
  const dur = videoDuration > 0 ? videoDuration : 12
  return Math.max(0.9, Math.min(DEFAULT_CUTAWAY_SECONDS, dur * 0.25))
}

// Rotate motion so a product's cutaway library doesn't end up as six
// identical slow zooms.
const MOTIONS: KenBurnsMotion[] = ['zoomIn', 'zoomOut', 'slideLeft', 'slideRight', 'slideUp', 'slideDown']

export function pickKenBurnsMotion(existingCount: number): KenBurnsMotion {
  return MOTIONS[existingCount % MOTIONS.length]
}

/**
 * Derive beat boundaries from a script by accumulating per-sentence read time.
 * Rough by design — it only needs to be close enough to avoid cutting
 * mid-word. ~2.3 words/sec is a natural UGC delivery pace.
 */
export function beatBoundariesFromScript(script: string | null | undefined): number[] {
  if (!script) return []
  const sentences = script
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean)
  if (sentences.length < 2) return []

  const WORDS_PER_SEC = 2.3
  const out: number[] = []
  let cursor = 0
  for (const s of sentences.slice(0, -1)) {
    cursor += s.split(/\s+/).filter(Boolean).length / WORDS_PER_SEC
    out.push(Number(cursor.toFixed(2)))
  }
  return out
}
