// Single source of truth for one-time credit packs.
// `key` matches the Dodo product env vars (DODO_PACK_<n> / DODO_TEST_PACK_<n>), so don't rename keys.
export const CREDIT_PACKS = [
  { key: 'pack_250',  credits: 350,  priceUSD: 8 },
  { key: 'pack_500',  credits: 700,  priceUSD: 15 },
  { key: 'pack_1500', credits: 2000, priceUSD: 45 },
  { key: 'pack_5000', credits: 6000, priceUSD: 130 },
] as const

export type PackKey = (typeof CREDIT_PACKS)[number]['key']

export const PACK_CREDITS: Record<string, number> = Object.fromEntries(
  CREDIT_PACKS.map(p => [p.key, p.credits]),
)

export const packPerCredit = (p: { credits: number; priceUSD: number }) => p.priceUSD / p.credits
