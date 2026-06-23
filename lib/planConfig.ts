export type PlanTier = 'free' | 'starter' | 'pro' | 'agency'
export type ContentFormat = 'ugc' | 'video' | 'image' | 'social' | 'blog' | 'voice' | 'email'
export type FormatFrequency = 0 | 1 | 2 | 3  // never / light / regular / heavy
export type FormatPreferences = Partial<Record<ContentFormat, FormatFrequency>>

// What effective plan tier to use for calendar generation
export function getEffectivePlan(plan: PlanTier): PlanTier {
  return plan === 'free' ? 'starter' : plan
}

// Static credit prices for non-UGC content. UGC pricing is dynamic and lives
// in lib/tiers.ts (calculateVideoCredits) since it depends on tier + duration.
export const CREDIT_COSTS: Record<string, number> = {
  social: 5,
  email: 10,
  blog: 20,
  image: 3,
  voice: 5, // min charge; actual = max(5, ceil(chars/80)) — see generate/voice/page
}

// 1 credit = $0.025 USD. Mirrored from lib/tiers.ts for places that don't
// import the UGC module.
export const CREDIT_USD_VALUE = 0.025

export const PLAN_CONFIG: Record<PlanTier, {
  priceUSD: number
  monthlyCredits: number
  signupBonus: number
  watermark: boolean
  monthlyTypeCaps: Record<ContentFormat, number>
  freeTrials: Partial<Record<ContentFormat, number>>
}> = {
  free: {
    priceUSD: 0,
    monthlyCredits: 0,
    signupBonus: 60,
    watermark: true,
    // 60cr ≈ 1 Standard 4s UGC + 3 product images. Capped so it can't go beyond that.
    monthlyTypeCaps: { ugc: 1, video: 0, voice: 1, image: 3, social: 3, blog: 1, email: 1 },
    freeTrials: { image: 3 },
  },
  starter: {
    priceUSD: 19,
    monthlyCredits: 800,
    signupBonus: 0,
    watermark: false,
    monthlyTypeCaps: { ugc: 12, video: 12, voice: 20, image: 50, social: Infinity, blog: Infinity, email: Infinity },
    freeTrials: {},
  },
  pro: {
    priceUSD: 49,
    monthlyCredits: 2000,
    signupBonus: 0,
    watermark: false,
    monthlyTypeCaps: { ugc: 30, video: 30, voice: 60, image: Infinity, social: Infinity, blog: Infinity, email: Infinity },
    freeTrials: {},
  },
  agency: {
    priceUSD: 149,
    monthlyCredits: 6500,
    signupBonus: 0,
    watermark: false,
    monthlyTypeCaps: { ugc: Infinity, video: Infinity, voice: Infinity, image: Infinity, social: Infinity, blog: Infinity, email: Infinity },
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
