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
  maxBrolls: 0 | 1 | 2 | 3    // Upper limit. Actual count is duration-dependent (see brollCountForDuration).
  available: boolean
}

// How many B-rolls actually make sense at each duration. Hard rule: B-rolls are
// useless on very short videos because there's no time to cut between them and
// the talking head. 4s = 0 (just show the Sora clip), 8s = 1, 12s+ = 2.
// Extended/chained durations may bump to 3 in Push 2.
export function brollCountForDuration(duration: UGCDuration, tierMax: number): number {
  let preferred: number
  if (duration <= 4) preferred = 0
  else if (duration <= 8) preferred = 1
  else if (duration <= 12) preferred = 2
  else if (duration <= 20) preferred = 2
  else preferred = 3 // extended 30s / chained 24s+
  return Math.min(preferred, tierMax)
}

export const TIERS: Record<UGCTier, TierConfig> = {
  standard: {
    label: 'Standard',
    tagline: 'Cinematic AI',
    description: 'Sora 2 with your real product, native AI voice, action B-rolls + captions.',
    aRollProvider: 'sora-2',
    useElevenLabs: false,
    maxBrolls: 2,
    available: true,
  },
  hero: {
    label: 'Hero',
    tagline: 'Branded voice',
    description: 'Sora 2 with your real product, your branded ElevenLabs voice lip-synced to the character, action B-rolls + captions.',
    aRollProvider: 'sora-2',
    useElevenLabs: true,
    maxBrolls: 2,
    available: true,
  },
}

export const DEFAULT_TIER: UGCTier = 'standard'
export const DEFAULT_DURATION: UGCDuration = 8

// === Credit math ===
// Tuned for ~3-4x markup on real API cost at 1cr = $0.025 USD.
//   BASE_FIXED: Nano Banana hero frame + Claude prompts + Shotstack stitch.
//   HERO_PREMIUM: Extra cost for Hero — ElevenLabs/OpenAI TTS overlay.
//   PER_SECOND_SORA: each second of Sora generation.
//   PER_BROLL: each rendered B-roll (Kling + optional Nano Banana action frame).
//              Actual B-roll count is duration-dependent (see brollCountForDuration).
//   PER_SECOND_FILL: each second of extended B-roll fill on extended durations.
//   CHAINED_OVERHEAD_PER_CLIP: per additional Sora call when chaining.
const BASE_FIXED = 12
// Hero premium covers ElevenLabs voice via Replicate (~$0.05) + sync/lipsync-2
// post-pass to match the character's mouth to the voice (~$0.15-0.20 per clip).
const HERO_PREMIUM = 28
const PER_SECOND_SORA = 8
const PER_BROLL = 4
const PER_SECOND_FILL = 2
const CHAINED_OVERHEAD_PER_CLIP = 10

export function calculateVideoCredits(tier: UGCTier, duration: UGCDuration): number {
  const dCfg = DURATION_CONFIGS[duration]
  const tierBase = BASE_FIXED + (tier === 'hero' ? HERO_PREMIUM : 0)
  if (!dCfg) return tierBase + PER_SECOND_SORA * 8

  // Charge only for the B-rolls this duration actually renders. Tier sets the ceiling.
  const tierMaxBrolls = TIERS[tier].maxBrolls
  const brollsRendered = brollCountForDuration(duration, tierMaxBrolls)
  const brollCost = PER_BROLL * brollsRendered

  if (dCfg.strategy === 'native') {
    return tierBase + PER_SECOND_SORA * dCfg.soraSeconds + brollCost
  }

  if (dCfg.strategy === 'extended') {
    const fillSeconds = dCfg.totalSeconds - 12
    return tierBase + PER_SECOND_SORA * 12 + PER_SECOND_FILL * fillSeconds + brollCost
  }

  // chained: N Sora clips, plus overhead per extra clip
  return tierBase
    + PER_SECOND_SORA * dCfg.soraSeconds * dCfg.soraClips
    + CHAINED_OVERHEAD_PER_CLIP * (dCfg.soraClips - 1)
    + brollCost
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

// === Standalone /generate/video pricing ===
// Plain Sora 2 prompt-to-video — no Nano Banana hero, no B-rolls, no Whisper, no stitch.
// Just Sora + optional reference image. Cheaper than UGC because we skip all the
// surrounding pipeline.
//   BASE_STANDALONE: covers reference-image handling + Sora API overhead
//   PER_SECOND_STANDALONE: each Sora second
const BASE_STANDALONE_VIDEO = 10
const PER_SECOND_STANDALONE_VIDEO = 5

export function calculateStandaloneVideoCredits(duration: UGCDuration): number {
  const dCfg = DURATION_CONFIGS[duration]
  if (!dCfg) return BASE_STANDALONE_VIDEO + PER_SECOND_STANDALONE_VIDEO * 8
  // Sora-only cost = base + sora seconds * per-sec. Chained durations still pay
  // per Sora second since each chained clip is a real generation.
  return BASE_STANDALONE_VIDEO + PER_SECOND_STANDALONE_VIDEO * dCfg.soraSeconds * dCfg.soraClips
}
