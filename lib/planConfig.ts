export type PlanTier = 'free' | 'starter' | 'pro' | 'agency'
export type VideoQuality = 'standard' | 'hd' | '4k'
export type ContentFormat = 'ugc' | 'video' | 'image' | 'social' | 'blog' | 'voice' | 'email'
export type FormatFrequency = 0 | 1 | 2 | 3  // never / light / regular / heavy
export type FormatPreferences = Partial<Record<ContentFormat, FormatFrequency>>

// What effective plan tier to use for calendar generation
export function getEffectivePlan(plan: PlanTier): PlanTier {
  return plan === 'free' ? 'starter' : plan
}

export const VIDEO_QUALITY_CONFIG: Record<VideoQuality, {
  label: string
  subtitle: string
  avatar: string
  resolution: string
  creditCost: number
  apiCostUSD: number
  plans: PlanTier[]
}> = {
  standard: {
    label: 'Standard',
    subtitle: 'Avatar III · 1080p',
    avatar: 'Avatar III',
    resolution: '1080p',
    creditCost: 40,
    apiCostUSD: 0.50,
    plans: ['free', 'starter', 'pro', 'agency'],
  },
  hd: {
    label: 'HD',
    subtitle: 'Avatar IV · 1080p',
    avatar: 'Avatar IV',
    resolution: '1080p',
    creditCost: 160,
    apiCostUSD: 2.00,
    plans: ['starter', 'pro', 'agency'],
  },
  '4k': {
    label: '4K Digital Twin',
    subtitle: 'Avatar IV · 4K',
    avatar: 'Avatar IV',
    resolution: '4K',
    creditCost: 200,
    apiCostUSD: 2.50,
    plans: ['pro', 'agency'],
  },
}

export const CREDIT_COSTS: Record<string, number> = {
  social: 5,
  email: 10,
  blog: 20,
  image: 3,
  voice: 12,
  video_standard: 40,
  video_hd: 160,
  video_4k: 200,
  ugc_standard: 40,
  ugc_hd: 160,
  ugc_4k: 200,
}

export const PLAN_CONFIG: Record<PlanTier, {
  monthlyCredits: number
  signupBonus: number
  videoQualities: VideoQuality[]
  monthlyTypeCaps: Record<ContentFormat, number>
  freeTrials: Partial<Record<ContentFormat, number>>
}> = {
  free: {
    monthlyCredits: 50,
    signupBonus: 150,
    videoQualities: ['standard'],
    monthlyTypeCaps: { video: 1, ugc: 1, voice: 2, image: 3, social: 10, blog: 5, email: 5 },
    freeTrials: { voice: 2, image: 3 },
  },
  starter: {
    monthlyCredits: 1000,
    signupBonus: 0,
    videoQualities: ['standard', 'hd'],
    monthlyTypeCaps: { video: 8, ugc: 8, voice: 15, image: 30, social: Infinity, blog: Infinity, email: Infinity },
    freeTrials: {},
  },
  pro: {
    monthlyCredits: 4000,
    signupBonus: 0,
    videoQualities: ['standard', 'hd', '4k'],
    monthlyTypeCaps: { video: 40, ugc: 40, voice: 60, image: Infinity, social: Infinity, blog: Infinity, email: Infinity },
    freeTrials: {},
  },
  agency: {
    monthlyCredits: 15000,
    signupBonus: 0,
    videoQualities: ['standard', 'hd', '4k'],
    monthlyTypeCaps: { video: Infinity, ugc: Infinity, voice: Infinity, image: Infinity, social: Infinity, blog: Infinity, email: Infinity },
    freeTrials: {},
  },
}

// Translate frequency value (0-3) to a human-readable weight for the AI prompt
export const FREQUENCY_LABELS: Record<FormatFrequency, string> = {
  0: 'never',
  1: 'occasionally (1-2x/month)',
  2: 'regularly (1-2x/week)',
  3: 'frequently (3-4x/week)',
}

export function buildFormatInstruction(prefs: FormatPreferences): string {
  const active = Object.entries(prefs)
    .filter(([, v]) => v && v > 0)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
    .map(([k, v]) => `${k}: ${FREQUENCY_LABELS[v as FormatFrequency]}`)
  if (!active.length) return ''
  return `Content format preferences (respect these weights): ${active.join(', ')}.`
}
