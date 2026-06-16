export type UGCTier = 'standard' | 'hero'
export type UGCDuration = 4 | 8 | 12
export type ARollProvider = 'sora-2'

export interface TierConfig {
  label: string
  tagline: string
  description: string
  aRollProvider: ARollProvider
  useElevenLabs: boolean      // Standard uses Sora native audio; Hero overlays a chosen voice
  brollCount: 0 | 1 | 2
  available: boolean
}

// Static tier definitions — only voice approach differs. Duration is independent
// and chosen separately by the user.
export const TIERS: Record<UGCTier, TierConfig> = {
  standard: {
    label: 'Standard',
    tagline: 'Cinematic AI',
    description: 'Sora 2 with your real product, native AI voice, 2 action B-rolls + captions.',
    aRollProvider: 'sora-2',
    useElevenLabs: false,
    brollCount: 2,
    available: true,
  },
  hero: {
    label: 'Hero',
    tagline: 'Branded voice',
    description: 'Sora 2 with your real product, your branded voice overlay (OpenAI TTS or ElevenLabs), 2 action B-rolls + captions.',
    aRollProvider: 'sora-2',
    useElevenLabs: true,
    brollCount: 2,
    available: true,
  },
}

export const DEFAULT_TIER: UGCTier = 'standard'
export const DEFAULT_DURATION: UGCDuration = 8
export const DURATION_OPTIONS: UGCDuration[] = [4, 8, 12]

// Credit cost = base (covers Nano Banana hero + 2 Kling B-rolls + Claude prompts +
// Shotstack stitch) + perSecond (covers Sora 2 render time per second).
// Hero adds a flat overhead for the voice overlay step.
// Numbers tuned for ~3× markup on real API cost at 1cr ≈ $0.05.
const BASE_COST: Record<UGCTier, number> = { standard: 20, hero: 40 }
const PER_SECOND: number = 8

export function calculateVideoCredits(tier: UGCTier, duration: UGCDuration): number {
  return BASE_COST[tier] + PER_SECOND * duration
}

// Pre-computed lookup table — used by the UI to show the cost of each combo
// without recomputing on every render. Keep in sync with calculateVideoCredits.
export const TIER_DURATION_CREDITS: Record<UGCTier, Record<UGCDuration, number>> = {
  standard: {
    4: calculateVideoCredits('standard', 4),   // 52
    8: calculateVideoCredits('standard', 8),   // 84
    12: calculateVideoCredits('standard', 12), // 116
  },
  hero: {
    4: calculateVideoCredits('hero', 4),   // 72
    8: calculateVideoCredits('hero', 8),   // 104
    12: calculateVideoCredits('hero', 12), // 136
  },
}

// Estimated wall-clock render time so the UI can show "~3 min" labels.
export function estimateRenderSeconds(duration: UGCDuration): number {
  // Sora roughly 1.5x realtime + Kling B-rolls ~60s + stitch ~30s
  return Math.round(duration * 1.5 + 90)
}
