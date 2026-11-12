// Pure helpers for the Dodo webhook (app/api/dodo/webhook/route.ts).
// Kept out of the route file so they can be unit tested.

import { createHmac, timingSafeEqual } from 'crypto'
import { PACK_CREDITS } from './credit-packs'

/**
 * Custom webhook verification that mirrors standardwebhooks' signature check
 * but skips the 5-minute timestamp tolerance. Dodo sometimes delivers events
 * with old timestamps (queued), and the strict SDK check rejects them.
 * We still verify HMAC signature so this is cryptographically safe.
 * Replays are stopped separately by the webhook_events de-duplication.
 */
export function verifyDodoSignature(rawBody: string, headers: Record<string, string>, secret: string): unknown {
  const lower: Record<string, string> = {}
  for (const k of Object.keys(headers)) lower[k.toLowerCase()] = headers[k]
  const msgId = lower['webhook-id']
  const msgSignature = lower['webhook-signature']
  const msgTimestamp = lower['webhook-timestamp']
  if (!msgId || !msgSignature || !msgTimestamp) throw new Error('Missing webhook headers')

  // Decode secret (standardwebhooks stores it as base64 after "whsec_" prefix)
  const secretBytes = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64')
  const toSign = `${msgId}.${msgTimestamp}.${rawBody}`
  const expected = createHmac('sha256', secretBytes).update(toSign).digest('base64')

  const passed = msgSignature.split(' ')
  for (const versioned of passed) {
    const [version, sig] = versioned.split(',')
    if (version !== 'v1' || !sig) continue
    if (sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return JSON.parse(rawBody)
    }
  }
  throw new Error('No matching signature')
}

// Credits granted per plan per month
export const PLAN_CREDITS: Record<string, number> = {
  lite:    300,
  starter: 800,
  pro:     2000,
  agency:  6500,
  enterprise: 25000,
}

// Build reverse map: Dodo product ID → pack key (checked at runtime so env vars are resolved)
export function getProductIdToPackKey(): Record<string, string> {
  const isTest = process.env.DODO_ENV !== 'production'
  const map: Record<string, string> = {}
  for (const packKey of Object.keys(PACK_CREDITS)) {
    const envKey = isTest
      ? `DODO_TEST_${packKey.toUpperCase()}`
      : `DODO_${packKey.toUpperCase()}`
    const productId = process.env[envKey]
    if (productId) map[productId] = packKey
  }
  return map
}

// Build reverse map: Dodo product ID → subscription plan key
export function getProductIdToPlanKey(): Record<string, string> {
  const isTest = process.env.DODO_ENV !== 'production'
  const map: Record<string, string> = {}
  for (const planKey of Object.keys(PLAN_CREDITS)) {
    for (const period of ['MONTHLY', 'ANNUAL']) {
      const envKey = isTest
        ? `DODO_TEST_PRODUCT_${planKey.toUpperCase()}_${period}`
        : `DODO_PRODUCT_${planKey.toUpperCase()}_${period}`
      const productId = process.env[envKey]
      if (productId) map[productId] = planKey
    }
  }
  return map
}
