// Required Vercel env vars for Stripe:
// STRIPE_SECRET_KEY                       — Stripe Dashboard > Developers > API Keys
// NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY      — same page (pk_live_... or pk_test_...)
// STRIPE_WEBHOOK_SECRET                   — Stripe Dashboard > Webhooks > endpoint secret
// NEXT_PUBLIC_STRIPE_PRICE_LITE           — Price ID for $6/mo Lite plan
// NEXT_PUBLIC_STRIPE_PRICE_LITE_ANNUAL    — Price ID for $60/yr Lite annual plan
// NEXT_PUBLIC_STRIPE_PRICE_STARTER        — Price ID for $19/mo Starter plan
// NEXT_PUBLIC_STRIPE_PRICE_STARTER_ANNUAL — Price ID for $190/yr Starter annual plan
// NEXT_PUBLIC_STRIPE_PRICE_PRO            — Price ID for $49/mo Pro plan
// NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL     — Price ID for $490/yr Pro annual plan
// NEXT_PUBLIC_STRIPE_PRICE_AGENCY         — Price ID for $149/mo Agency plan
// NEXT_PUBLIC_STRIPE_PRICE_AGENCY_ANNUAL  — Price ID for $1490/yr Agency annual plan
// NEXT_PUBLIC_STRIPE_PRICE_PACK_250       — Price ID for 250 cr one-time pack ($8)
// NEXT_PUBLIC_STRIPE_PRICE_PACK_500       — Price ID for 500 cr one-time pack ($15)
// NEXT_PUBLIC_STRIPE_PRICE_PACK_1500      — Price ID for 1500 cr one-time pack ($45)
// NEXT_PUBLIC_STRIPE_PRICE_PACK_5000      — Price ID for 5000 cr one-time pack ($120)

import Stripe from 'stripe'

// Lazy singleton — only instantiated when first called, not at module load time.
// This prevents build failures when STRIPE_SECRET_KEY is not set.
let _stripe: Stripe | null = null
export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-04-30.basil' as any })
  }
  return _stripe
}

// Keep named export for backwards compat — also lazy
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getStripe() as any)[prop]
  },
})

export const PLAN_PRICE_MAP: Record<string, { plan: string; monthly_credits: number }> = {
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE ?? 'price_lite']: { plan: 'lite', monthly_credits: 200 },
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE_ANNUAL ?? 'price_lite_annual']: { plan: 'lite', monthly_credits: 200 },
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER ?? 'price_starter']: { plan: 'starter', monthly_credits: 800 },
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_ANNUAL ?? 'price_starter_annual']: { plan: 'starter', monthly_credits: 800 },
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? 'price_pro']: { plan: 'pro', monthly_credits: 2000 },
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL ?? 'price_pro_annual']: { plan: 'pro', monthly_credits: 2000 },
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_AGENCY ?? 'price_agency']: { plan: 'agency', monthly_credits: 6500 },
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_AGENCY_ANNUAL ?? 'price_agency_annual']: { plan: 'agency', monthly_credits: 6500 },
}

export const PACK_CREDIT_MAP: Record<string, number> = {
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_PACK_250 ?? 'price_pack250']: 250,
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_PACK_500 ?? 'price_pack500']: 500,
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_PACK_1500 ?? 'price_pack1500']: 1500,
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_PACK_5000 ?? 'price_pack5000']: 5000,
}
