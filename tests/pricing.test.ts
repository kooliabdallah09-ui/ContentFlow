// Checks that what we charge in credits always covers what the render really
// costs us (official BytePlus Seedance prices + Nano Banana frames + Claude).
import { describe, it, expect } from 'vitest'
import { ugcPackageCost, heroFrameCount, type UGCResolution } from '@/lib/ugc-pricing'
import { CREDIT_PACKS } from '@/lib/credit-packs'

// Official BytePlus costs for a 5 s portrait clip (from the BytePlus calculator).
const SEEDANCE_5S: Record<string, number> = {
  'seedance-2:480p': 0.3515,
  'seedance-2:720p': 0.756,
  'seedance-2:1080p': 1.8711,
  'seedance-mini:480p': 0.1758,
  'seedance-mini:720p': 0.378,
}
const FRAME = 0.075  // Nano Banana Pro, one starting frame
const CLAUDE = 0.01  // script + prompts

function rawCostUSD(engine: 'seedance-2' | 'seedance-mini', res: UGCResolution, seconds: number) {
  const per5 = SEEDANCE_5S[`${engine}:${res}`]
  return (per5 / 5) * seconds + CLAUDE + FRAME * heroFrameCount(engine)
}

// What one credit earns us, cheapest first. Monthly plans: price / credits.
const MONTHLY_PLANS = { lite: 8 / 300, starter: 19 / 800, pro: 49 / 2000, agency: 149 / 6500 }
const PACKS = Object.fromEntries(CREDIT_PACKS.map(p => [p.key, p.priceUSD / p.credits]))

describe('known prices', () => {
  it('full quality 5 s 720p costs 49 credits', () => {
    expect(ugcPackageCost(5, '720p', 'seedance-2')).toBe(49)
  })
  it('draft 5 s 720p costs 21 credits', () => {
    expect(ugcPackageCost(5, '720p', 'seedance-mini')).toBe(21)
  })
  it('draft bills 1 frame, full quality bills 2', () => {
    expect(heroFrameCount('seedance-mini')).toBe(1)
    expect(heroFrameCount('seedance-2')).toBe(2)
  })
  it('longer videos never cost fewer credits', () => {
    for (const res of ['480p', '720p', '1080p'] as const) {
      let prev = 0
      for (const s of [5, 10, 15, 30]) {
        const c = ugcPackageCost(s, res, 'seedance-2')
        expect(c).toBeGreaterThan(prev)
        prev = c
      }
    }
  })
})

describe('full quality never sells below cost', () => {
  const cases = [
    ['480p', 5], ['720p', 5], ['720p', 10], ['720p', 15], ['1080p', 5], ['1080p', 10],
  ] as const
  for (const [res, s] of cases) {
    for (const [name, perCredit] of Object.entries({ ...MONTHLY_PLANS, ...PACKS })) {
      it(`${s}s ${res} on ${name}`, () => {
        const revenue = ugcPackageCost(s, res, 'seedance-2') * perCredit
        expect(revenue).toBeGreaterThan(rawCostUSD('seedance-2', res, s))
      })
    }
  }
})

describe('drafts never sell below cost on monthly plans', () => {
  for (const [res, s] of [['480p', 5], ['720p', 5], ['720p', 10]] as const) {
    for (const [name, perCredit] of Object.entries(MONTHLY_PLANS)) {
      it(`${s}s ${res} on ${name}`, () => {
        const revenue = ugcPackageCost(s, res, 'seedance-mini') * perCredit
        expect(revenue).toBeGreaterThan(rawCostUSD('seedance-mini', res, s))
      })
    }
  }
})
