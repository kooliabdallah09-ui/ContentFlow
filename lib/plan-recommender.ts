// Recommend a subscription tier (or a top-up pack) based on the user's
// declared format mix + posting frequency during onboarding.
//
// The math: convert each format's frequency weight (0–3) into an expected
// number of posts per month (weighted by the frequency chip), multiply by
// that format's typical credit cost, sum, and match to a plan.

import type { FormatPreferences } from './planConfig'

// Average credit cost per single generation of each format at reasonable
// default settings. UGC dominates by far — a 10s UGC at 720p ≈ 125 cr.
const AVG_COST_PER_POST: Record<keyof FormatPreferences, number> = {
  ugc: 125,          // 10s Seedance 720p UGC
  video: 65,         // 5s Seedance standalone video
  image: 10,         // NB Pro 2K
  social: 5,         // caption post
  'screen-demo': 30, // screen-demo package
  blog: 10,
  voice: 5,
  email: 3,
}

// How many posts per month each "weight" implies.
// 1 = Light, 2 = Regular, 3 = Heavy. Total across selected formats then
// bounded by the frequency ceiling below.
const WEIGHT_TO_POSTS: Record<number, number> = { 0: 0, 1: 4, 2: 10, 3: 18 }

// Cap by declared overall posting frequency.
const FREQUENCY_MONTHLY_CAP: Record<string, number> = {
  light: 12,     // ~2–3/wk
  moderate: 20,  // ~4–5/wk
  heavy: 30,     // ~6–7/wk
}

export interface Recommendation {
  monthlyCredits: number
  plan: 'starter' | 'pro' | 'agency'
  planName: 'Starter' | 'Pro' | 'Agency'
  planPrice: string
  reason: string
  suggestPack?: { credits: 500 | 1500 | 5000; price: string; reason: string }
}

export function recommendPlan(opts: {
  formatPrefs: FormatPreferences
  frequency: string
}): Recommendation {
  const { formatPrefs, frequency } = opts

  // Distribute the monthly post cap across formats by their weights.
  const cap = FREQUENCY_MONTHLY_CAP[frequency] ?? 20
  const weights = (Object.keys(AVG_COST_PER_POST) as Array<keyof FormatPreferences>)
    .map(fmt => ({ fmt, w: WEIGHT_TO_POSTS[formatPrefs[fmt] ?? 0] }))
    .filter(x => x.w > 0)
  const totalWeight = weights.reduce((s, x) => s + x.w, 0)
  if (!totalWeight) {
    return {
      monthlyCredits: 800,
      plan: 'starter',
      planName: 'Starter',
      planPrice: '$19/mo',
      reason: 'A safe starting point — you can top up any time.',
    }
  }
  let monthlyCredits = 0
  for (const { fmt, w } of weights) {
    const posts = Math.round((w / totalWeight) * cap)
    monthlyCredits += posts * AVG_COST_PER_POST[fmt]
  }
  // Add a 10% headroom so users don't hit zero mid-month.
  monthlyCredits = Math.round(monthlyCredits * 1.1 / 50) * 50

  // Match to a plan.
  if (monthlyCredits <= 800) {
    return {
      monthlyCredits,
      plan: 'starter',
      planName: 'Starter',
      planPrice: '$19/mo',
      reason: `Your mix runs about ${monthlyCredits} credits/month. Starter covers it comfortably.`,
    }
  }
  if (monthlyCredits <= 2000) {
    return {
      monthlyCredits,
      plan: 'pro',
      planName: 'Pro',
      planPrice: '$49/mo',
      reason: `Your mix runs about ${monthlyCredits} credits/month. Pro is the sweet spot — cheaper per credit than a pack top-up.`,
    }
  }
  if (monthlyCredits <= 6500) {
    return {
      monthlyCredits,
      plan: 'agency',
      planName: 'Agency',
      planPrice: '$149/mo',
      reason: `Your mix runs about ${monthlyCredits} credits/month. Agency covers it and gives you the best per-credit rate.`,
    }
  }
  // Beyond Agency: recommend Agency + a 5000 pack.
  return {
    monthlyCredits,
    plan: 'agency',
    planName: 'Agency',
    planPrice: '$149/mo',
    reason: `Your mix needs ~${monthlyCredits.toLocaleString()} credits/month — beyond any plan alone.`,
    suggestPack: { credits: 5000, price: '$120', reason: 'Top up with a 5,000-credit pack (best per-credit rate).' },
  }
}
