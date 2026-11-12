import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'crypto'
import { verifyDodoSignature, getProductIdToPackKey, getProductIdToPlanKey, PLAN_CREDITS as WEBHOOK_PLAN_CREDITS } from '@/lib/dodo-webhook'
import { CREDIT_PACKS, PACK_CREDITS } from '@/lib/credit-packs'
import { PLAN_CREDITS } from '@/lib/credits'

describe('signup and plan credits', () => {
  it('new free accounts get 30 credits once', () => {
    expect(PLAN_CREDITS.free.signup_bonus).toBe(30)
    expect(PLAN_CREDITS.free.monthly).toBe(0)
  })
  it('webhook grants the same monthly credits as lib/credits', () => {
    expect(WEBHOOK_PLAN_CREDITS.starter).toBe(PLAN_CREDITS.starter.monthly)
    expect(WEBHOOK_PLAN_CREDITS.pro).toBe(PLAN_CREDITS.pro.monthly)
    expect(WEBHOOK_PLAN_CREDITS.agency).toBe(PLAN_CREDITS.agency.monthly)
  })
})

describe('credit packs', () => {
  it('match the Dodo products (350/$8, 700/$15, 2000/$45, 6000/$130)', () => {
    expect(CREDIT_PACKS.map(p => [p.credits, p.priceUSD])).toEqual([
      [350, 8], [700, 15], [2000, 45], [6000, 130],
    ])
  })
  it('webhook grant table matches the packs', () => {
    for (const p of CREDIT_PACKS) expect(PACK_CREDITS[p.key]).toBe(p.credits)
  })
})

describe('Dodo product id mapping', () => {
  const saved = { ...process.env }
  afterEach(() => { process.env = { ...saved } })

  it('test mode reads DODO_TEST_PACK_*', () => {
    process.env.DODO_ENV = 'test'
    process.env.DODO_TEST_PACK_250 = 'pdt_test_small'
    process.env.DODO_TEST_PRODUCT_PRO_MONTHLY = 'pdt_test_pro'
    expect(getProductIdToPackKey()['pdt_test_small']).toBe('pack_250')
    expect(getProductIdToPlanKey()['pdt_test_pro']).toBe('pro')
  })
  it('live mode reads DODO_PACK_* (not DODO_PRODUCT_PACK_*)', () => {
    process.env.DODO_ENV = 'production'
    process.env.DODO_PACK_5000 = 'pdt_live_big'
    process.env.DODO_PRODUCT_PACK_250 = 'pdt_wrong_name'
    const map = getProductIdToPackKey()
    expect(map['pdt_live_big']).toBe('pack_5000')
    expect(map['pdt_wrong_name']).toBeUndefined()
  })
})

describe('Dodo webhook signature', () => {
  const secretRaw = Buffer.from('a-test-secret-of-some-length').toString('base64')
  const secret = `whsec_${secretRaw}`
  const body = JSON.stringify({ type: 'payment.succeeded', data: { payment_id: 'pay_1' } })
  let headers: Record<string, string>

  function sign(id: string, ts: string, raw: string) {
    return createHmac('sha256', Buffer.from(secretRaw, 'base64')).update(`${id}.${ts}.${raw}`).digest('base64')
  }

  beforeEach(() => {
    headers = { 'webhook-id': 'msg_1', 'webhook-timestamp': '1700000000', 'webhook-signature': `v1,${sign('msg_1', '1700000000', body)}` }
  })

  it('accepts a correctly signed event', () => {
    expect(verifyDodoSignature(body, headers, secret)).toEqual(JSON.parse(body))
  })
  it('accepts header names in any case', () => {
    const upper = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toUpperCase(), v]))
    expect(verifyDodoSignature(body, upper, secret)).toEqual(JSON.parse(body))
  })
  it('rejects a changed body', () => {
    expect(() => verifyDodoSignature(body.replace('pay_1', 'pay_2'), headers, secret)).toThrow()
  })
  it('rejects a wrong secret', () => {
    expect(() => verifyDodoSignature(body, headers, `whsec_${Buffer.from('other').toString('base64')}`)).toThrow()
  })
  it('rejects missing headers', () => {
    expect(() => verifyDodoSignature(body, { 'webhook-id': 'msg_1' }, secret)).toThrow('Missing webhook headers')
  })
  it('rejects a malformed signature without crashing', () => {
    expect(() => verifyDodoSignature(body, { ...headers, 'webhook-signature': 'v1' }, secret)).toThrow('No matching signature')
  })
})
