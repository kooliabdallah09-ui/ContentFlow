// Paddle (merchant of record) billing config. Sandbox price IDs are the
// defaults; live IDs override via env when the live account is approved.

export const PADDLE_PRICES = {
  lite: process.env.NEXT_PUBLIC_PADDLE_PRICE_LITE ?? '',
  liteAnnual: process.env.NEXT_PUBLIC_PADDLE_PRICE_LITE_ANNUAL ?? '',
  starter: process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER ?? 'pri_01kxxpjstsqmg9v55jnekjv7qs',
  starterAnnual: process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_ANNUAL ?? 'pri_01kxxpjt59xejfhztfermvmsaj',
  pro: process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO ?? 'pri_01kxxpjtf6mx2zf3faxnd4zjyy',
  proAnnual: process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_ANNUAL ?? 'pri_01kxxpjtw3dndzaced7513ek86',
  agency: process.env.NEXT_PUBLIC_PADDLE_PRICE_AGENCY ?? 'pri_01kxxpjv6ar38mq0har520qg6f',
  agencyAnnual: process.env.NEXT_PUBLIC_PADDLE_PRICE_AGENCY_ANNUAL ?? 'pri_01kxxpjvfy11hq9c9kveq44etk',
  pack250: process.env.NEXT_PUBLIC_PADDLE_PRICE_PACK_250 ?? '',
  pack500: process.env.NEXT_PUBLIC_PADDLE_PRICE_PACK_500 ?? 'pri_01kxxpjvv1epwxn2cwa6qggf9e',
  pack1500: process.env.NEXT_PUBLIC_PADDLE_PRICE_PACK_1500 ?? 'pri_01kxxpjw4htyj75h0wseqpw935',
  pack5000: process.env.NEXT_PUBLIC_PADDLE_PRICE_PACK_5000 ?? 'pri_01kxxpjweyaj3wf4d6jftz7b4q',
} as const

export const PADDLE_PLAN_PRICE_MAP: Record<string, { plan: string; monthly_credits: number }> = {
  [PADDLE_PRICES.starter]: { plan: 'starter', monthly_credits: 800 },
  [PADDLE_PRICES.starterAnnual]: { plan: 'starter', monthly_credits: 800 },
  [PADDLE_PRICES.pro]: { plan: 'pro', monthly_credits: 2000 },
  [PADDLE_PRICES.proAnnual]: { plan: 'pro', monthly_credits: 2000 },
  [PADDLE_PRICES.agency]: { plan: 'agency', monthly_credits: 6500 },
  [PADDLE_PRICES.agencyAnnual]: { plan: 'agency', monthly_credits: 6500 },
}

export const PADDLE_PACK_CREDIT_MAP: Record<string, number> = {
  [PADDLE_PRICES.pack500]: 500,
  [PADDLE_PRICES.pack1500]: 1500,
  [PADDLE_PRICES.pack5000]: 5000,
}
