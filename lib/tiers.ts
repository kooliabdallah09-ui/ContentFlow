export type UGCTier = 'lean' | 'premium' | 'hero'
export type ARollProvider = 'heygen-stock' | 'sora-2'

export interface TierConfig {
  label: string
  tagline: string
  description: string
  aRollProvider: ARollProvider
  useAvatarIV: boolean       // legacy field — kept for compatibility, only meaningful when aRollProvider='heygen-stock'
  useElevenLabs: boolean     // legacy field — Sora tiers use native audio; HeyGen tiers can opt in
  brollCount: 0 | 1 | 2
  videoCredits: number
  durationSeconds: 5 | 10 | 15 | 20
  available: boolean
  estimatedTime: string
}

export const TIERS: Record<UGCTier, TierConfig> = {
  lean: {
    label: 'Lean',
    tagline: 'Fast & cheap',
    description: 'Stock avatar, HeyGen voice, 1 action B-roll. Best for hook testing and high-volume drafts.',
    aRollProvider: 'heygen-stock',
    useAvatarIV: false,
    useElevenLabs: false,
    brollCount: 1,
    videoCredits: 25,
    durationSeconds: 15,
    available: true,
    estimatedTime: '~90s',
  },
  premium: {
    label: 'Premium',
    tagline: 'Recommended',
    description: 'Sora 2 cinematic AI character with your real product, native audio, 2 action B-rolls.',
    aRollProvider: 'sora-2',
    useAvatarIV: false,
    useElevenLabs: false,
    brollCount: 2,
    videoCredits: 40,
    durationSeconds: 15,
    available: true,
    estimatedTime: '~4 min',
  },
  hero: {
    label: 'Hero',
    tagline: 'Best quality',
    description: 'Sora 2 long-form cinematic, your real product, 2 action B-rolls, longer script. Best for launches.',
    aRollProvider: 'sora-2',
    useAvatarIV: false,
    useElevenLabs: false,
    brollCount: 2,
    videoCredits: 150,
    durationSeconds: 20,
    available: true,
    estimatedTime: '~5 min',
  },
}

export const DEFAULT_TIER: UGCTier = 'premium'
