export type UGCTier = 'lean' | 'premium' | 'hero'
export type ARollProvider = 'heygen-stock' | 'sora-2'

export interface TierConfig {
  label: string
  tagline: string
  description: string
  aRollProvider: ARollProvider
  useAvatarIV: boolean       // legacy field — kept for compatibility, only meaningful when aRollProvider='heygen-stock'
  useElevenLabs: boolean     // HeyGen tiers: ElevenLabs vs HeyGen TTS. Sora tiers: ElevenLabs overlay vs Sora native audio.
  brollCount: 0 | 1 | 2
  videoCredits: number
  durationSeconds: 4 | 8 | 12   // Sora 2 only supports 4 / 8 / 12 per clip; HeyGen ignores this field
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
    durationSeconds: 12,
    available: true,
    estimatedTime: '~90s',
  },
  premium: {
    label: 'Premium',
    tagline: 'Recommended',
    description: 'Sora 2 cinematic AI character with your real product, Sora native audio, 2 action B-rolls.',
    aRollProvider: 'sora-2',
    useAvatarIV: false,
    useElevenLabs: false, // Sora native audio
    brollCount: 2,
    videoCredits: 40,
    durationSeconds: 8,
    available: true,
    estimatedTime: '~4 min',
  },
  hero: {
    label: 'Hero',
    tagline: 'Best quality',
    description: 'Sora 2 cinematic with your real product, your branded ElevenLabs voice, 2 action B-rolls.',
    aRollProvider: 'sora-2',
    useAvatarIV: false,
    useElevenLabs: true,  // ElevenLabs overlay on top of muted Sora video
    brollCount: 2,
    videoCredits: 150,
    durationSeconds: 12,
    available: true,
    estimatedTime: '~5 min',
  },
}

export const DEFAULT_TIER: UGCTier = 'premium'
