export type UGCTier = 'standard' | 'hero'
export type ARollProvider = 'sora-2'

// Sora 2 caps each generation at 12s. Longer videos use one of two strategies:
//   - 'extended': one 12s Sora + voiceover continues over additional B-rolls
//   - 'chained':  multiple Sora generations (same Nano Banana reference frame)
//                 stitched back-to-back. Higher cost, true long-form.
export type DurationStrategy = 'native' | 'extended' | 'chained'

export interface DurationConfig {
  totalSeconds: number     // total final video duration
  soraSeconds: 4 | 8 | 12  // length of each Sora generation
  soraClips: 1 | 2 | 3     // how many Sora generations to chain
  strategy: DurationStrategy
  label: string
  available: boolean       // false = shown in UI but disabled (orchestration not built yet)
}

// All available durations. Order matters — UI renders in this order with
// a divider between strategies.
export const DURATION_CONFIGS: Record<number, DurationConfig> = {
  4:  { totalSeconds: 4,  soraSeconds: 4,  soraClips: 1, strategy: 'native',   label: '4s',  available: true  },
  8:  { totalSeconds: 8,  soraSeconds: 8,  soraClips: 1, strategy: 'native',   label: '8s',  available: true  },
  12: { totalSeconds: 12, soraSeconds: 12, soraClips: 1, strategy: 'native',   label: '12s', available: true  },
  20: { totalSeconds: 20, soraSeconds: 12, soraClips: 1, strategy: 'extended', label: '20s', available: false },
  30: { totalSeconds: 30, soraSeconds: 12, soraClips: 1, strategy: 'extended', label: '30s', available: false },
  24: { totalSeconds: 24, soraSeconds: 12, soraClips: 2, strategy: 'chained',  label: '24s', available: false },
  36: { totalSeconds: 36, soraSeconds: 12, soraClips: 3, strategy: 'chained',  label: '36s', available: false },
}

export const DURATION_OPTIONS = [4, 8, 12, 20, 30, 24, 36] as const
export type UGCDuration = typeof DURATION_OPTIONS[number]

export interface TierConfig {
  label: string
  tagline: string
  description: string
  aRollProvider: ARollProvider
  useElevenLabs: boolean      // Standard uses Sora native audio; Hero overlays a chosen voice
  brollCount: 0 | 1 | 2 | 3   // B-roll count grows for extended durations during stitch
  available: boolean
}

export const TIERS: Record<UGCTier, TierConfig> = {
  standard: {
    label: 'Standard',
    tagline: 'Cinematic AI',
    description: 'Sora 2 with your real product, native AI voice, action B-rolls + captions.',
    aRollProvider: 'sora-2',
    useElevenLabs: false,
    brollCount: 2,
    available: true,
  },
  hero: {
    label: 'Hero',
    tagline: 'Branded voice',
    description: 'Sora 2 with your real product, your branded voice overlay (OpenAI TTS or ElevenLabs), action B-rolls + captions.',
    aRollProvider: 'sora-2',
    useElevenLabs: true,
    brollCount: 2,
    available: true,
  },
}

export const DEFAULT_TIER: UGCTier = 'standard'
export const DEFAULT_DURATION: UGCDuration = 8

// === Credit math ===
// Tuned for ~3-4x markup on real API cost at 1cr = $0.025 USD.
//   base: covers Nano Banana hero frame, Kling B-rolls, Claude prompts, stitch.
//   PER_SECOND_SORA: each second of Sora generation.
//   PER_SECOND_FILL: each second of extended B-roll fill — much cheaper.
//   CHAINED_OVERHEAD_PER_CLIP: per additional Sora call when chaining.
const BASE_COST: Record<UGCTier, number> = { standard: 20, hero: 40 }
const PER_SECOND_SORA = 8
const PER_SECOND_FILL = 2
const CHAINED_OVERHEAD_PER_CLIP = 10

export function calculateVideoCredits(tier: UGCTier, duration: UGCDuration): number {
  const dCfg = DURATION_CONFIGS[duration]
  const base = BASE_COST[tier]
  if (!dCfg) return base + PER_SECOND_SORA * 8

  if (dCfg.strategy === 'native') {
    return base + PER_SECOND_SORA * dCfg.soraSeconds
  }

  if (dCfg.strategy === 'extended') {
    // 12s Sora + remainder as cheaper B-roll fill
    const fillSeconds = dCfg.totalSeconds - 12
    return base + PER_SECOND_SORA * 12 + PER_SECOND_FILL * fillSeconds
  }

  // chained: N Sora clips of soraSeconds each, plus overhead per extra clip
  return base
    + PER_SECOND_SORA * dCfg.soraSeconds * dCfg.soraClips
    + CHAINED_OVERHEAD_PER_CLIP * (dCfg.soraClips - 1)
}

// Pre-computed for UI render perf.
export const TIER_DURATION_CREDITS: Record<UGCTier, Record<UGCDuration, number>> = (() => {
  const out: Partial<Record<UGCTier, Record<UGCDuration, number>>> = {}
  for (const tier of ['standard', 'hero'] as UGCTier[]) {
    const row: Partial<Record<UGCDuration, number>> = {}
    for (const d of DURATION_OPTIONS) row[d] = calculateVideoCredits(tier, d)
    out[tier] = row as Record<UGCDuration, number>
  }
  return out as Record<UGCTier, Record<UGCDuration, number>>
})()

// Wall-clock render estimate. Chained Sora multiplies the Sora portion.
export function estimateRenderSeconds(duration: UGCDuration): number {
  const dCfg = DURATION_CONFIGS[duration]
  if (!dCfg) return 240
  const soraTime = dCfg.soraSeconds * dCfg.soraClips * 1.5
  return Math.round(soraTime + 120 + 30) // + B-rolls + stitch
}

// 1 credit = $0.025 USD. Exposed so UI can show "≈$2.10" next to credit costs.
export const CREDIT_USD_VALUE = 0.025

export function creditsToUSD(credits: number): number {
  return Math.round(credits * CREDIT_USD_VALUE * 100) / 100
}
