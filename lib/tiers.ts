export type UGCTier = 'lean' | 'premium' | 'hero'

export interface TierConfig {
  label: string
  tagline: string
  description: string
  useAvatarIV: boolean       // create Photo Avatar w/ motion_prompt vs stock avatar
  useElevenLabs: boolean     // ElevenLabs voice vs HeyGen TTS
  brollCount: 0 | 1 | 2
  videoCredits: number
  available: boolean
  estimatedTime: string
}

export const TIERS: Record<UGCTier, TierConfig> = {
  lean: {
    label: 'Lean',
    tagline: 'Fast & cheap',
    description: 'Stock avatar, HeyGen voice, 1 B-roll. Best for hook testing and high-volume drafts.',
    useAvatarIV: false,
    useElevenLabs: false,
    brollCount: 1,
    videoCredits: 25,
    available: true,
    estimatedTime: '~90s',
  },
  premium: {
    label: 'Premium',
    tagline: 'Recommended',
    description: 'Custom avatar from your product photo, ElevenLabs voice, 2 B-rolls, natural motion.',
    useAvatarIV: true,
    useElevenLabs: true,
    brollCount: 2,
    videoCredits: 40,
    available: true,
    estimatedTime: '~3 min',
  },
  hero: {
    label: 'Hero',
    tagline: 'Coming soon',
    description: 'Veo 3.1 native cinematic video with synced audio, 3 variants to pick from. Best for launches.',
    useAvatarIV: true,
    useElevenLabs: true,
    brollCount: 2,
    videoCredits: 150,
    available: false,
    estimatedTime: '~5 min',
  },
}

export const DEFAULT_TIER: UGCTier = 'premium'
