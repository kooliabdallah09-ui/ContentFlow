import crypto from 'crypto'
import type { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Signed OAuth `state` for third-party connects (TikTok, Google Drive).
//
// The old flow put `userId` in a plain base64 state taken from the query
// string, so anyone who knew a user's id could attach THEIR account to that
// user. Now: the connect route only runs for a signed-in user (Bearer token),
// signs { user, platform, nonce, expiry } with a server secret, and drops the
// nonce in an httpOnly cookie. The callback accepts the state only if the
// signature, expiry, platform and cookie nonce all match.

const TTL_MS = 10 * 60 * 1000

function secret(): Buffer {
  const explicit = process.env.OAUTH_STATE_SECRET
  if (explicit) return Buffer.from(explicit)
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base) throw new Error('No secret available for OAuth state')
  return crypto.createHmac('sha256', 'cf-oauth-state-v1').update(base).digest()
}

const sign = (data: string) => crypto.createHmac('sha256', secret()).update(data).digest('base64url')
const cookieName = (platform: string) => `cf_oauth_${platform.replace(/[^a-z]/g, '')}`

/** The signed-in user's id from `Authorization: Bearer <supabase access token>`. */
export async function userFromBearer(req: NextRequest): Promise<string | null> {
  const header = req.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data } = await admin.auth.getUser(header.slice(7))
  return data.user?.id ?? null
}

/** A signed state for `userId`, plus the nonce to put in the cookie via `setStateCookie`. */
export function newOAuthState(userId: string, platform: string): { state: string; nonce: string } {
  const nonce = crypto.randomBytes(16).toString('hex')
  const payload = Buffer.from(JSON.stringify({ u: userId, p: platform, n: nonce, e: Date.now() + TTL_MS })).toString('base64url')
  return { state: `${payload}.${sign(payload)}`, nonce }
}

export function setStateCookie(res: NextResponse, platform: string, nonce: string) {
  res.cookies.set(cookieName(platform), nonce, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: TTL_MS / 1000,
  })
}

/** The user id the state was issued for, or null if anything doesn't check out. */
export function verifyOAuthState(req: NextRequest, state: string | null, platform: string): string | null {
  if (!state) return null
  const [payload, sig] = state.split('.')
  if (!payload || !sig) return null
  const expected = sign(payload)
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { u?: string; p?: string; n?: string; e?: number }
    const cookieNonce = req.cookies.get(cookieName(platform))?.value
    if (!d.u || d.p !== platform || !d.e || d.e < Date.now() || !cookieNonce || cookieNonce !== d.n) return null
    return d.u
  } catch {
    return null
  }
}

/** Clear the nonce cookie once the callback has used it. */
export function clearOAuthState(res: NextResponse, platform: string) {
  res.cookies.set(cookieName(platform), '', { path: '/', maxAge: 0 })
}

/** Short-lived signed token for URLs that must work without a session (TikTok pulling a video). */
export function signToken(data: Record<string, unknown>, ttlMs: number): string {
  const payload = Buffer.from(JSON.stringify({ ...data, e: Date.now() + ttlMs })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function readToken<T extends Record<string, unknown>>(token: string): T | null {
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const expected = sign(payload)
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T & { e?: number }
    if (!d.e || d.e < Date.now()) return null
    return d
  } catch {
    return null
  }
}
