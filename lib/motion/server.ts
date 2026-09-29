// Shared plumbing for the /api/motion/* routes: auth, brief validation, and
// the signed job token that ties free fix-up calls to a paid write.

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { MotionBrief, MotionStoryboard } from './generate'
import { MOTION_TONES, motionTrack, type MotionTone } from './music'
import { canAccessMotionAds } from '@/lib/pov-access'

/** One motion ad: storyboard, write, self-review and up to MOTION_FIXES_PER_AD fixes. */
export const MOTION_AD_CREDITS = 35
export const MOTION_FIXES_PER_AD = 3

export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

/** The signed-in user's id, or null if not signed in or not allowed into motion ads yet. */
export async function authUser(req: NextRequest): Promise<string | null> {
  const header = req.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const { data } = await adminClient().auth.getUser(header.slice(7))
  if (!data.user || !canAccessMotionAds(data.user.email)) return null
  return data.user.id
}

export async function creditBalance(userId: string): Promise<{ balance: number; pack_credits: number } | null> {
  const { data } = await adminClient().from('user_credits').select('balance, pack_credits').eq('user_id', userId).maybeSingle()
  return data ? { balance: data.balance ?? 0, pack_credits: data.pack_credits ?? 0 } : null
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Validates and trims a brief from a request body. Returns an error message instead when it's unusable. */
export function parseBrief(raw: unknown): MotionBrief | string {
  const b = (raw ?? {}) as Record<string, unknown>
  const brandName = str(b.brandName, 60)
  const product = str(b.product, 1200)
  if (!brandName) return 'Add your brand name'
  if (product.length < 10) return 'Describe the product in a sentence or two'
  const tone = (Object.keys(MOTION_TONES) as MotionTone[]).includes(b.tone as MotionTone) ? (b.tone as MotionTone) : 'playful'
  const trackKey = b.trackKey === null ? null : motionTrack(str(b.trackKey, 40))?.key ?? MOTION_TONES[tone].track
  return {
    brandName,
    product,
    audience: str(b.audience, 300) || undefined,
    idea: str(b.idea, 600) || undefined,
    cta: str(b.cta, 30) || undefined,
    website: str(b.website, 80) || undefined,
    tone,
    trackKey,
    hasProductImage: b.hasProductImage === true,
    hasLogo: b.hasLogo === true,
    storyboard: parseStoryboard(b.storyboard),
  }
}

function parseStoryboard(raw: unknown): MotionStoryboard | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  const scenes = Array.isArray(s.scenes) ? s.scenes.slice(0, 8) : []
  if (scenes.length === 0) return null
  return {
    angle: str(s.angle, 400),
    hook: str(s.hook, 400),
    scenes: scenes.map(sc => {
      const c = (sc ?? {}) as Record<string, unknown>
      const seconds = Number(c.seconds)
      return { seconds: Number.isFinite(seconds) ? Math.min(8, Math.max(1, seconds)) : 3, title: str(c.title, 60), action: str(c.action, 600), text: str(c.text, 300) }
    }),
    punchline: str(s.punchline, 300),
    shareCopy: str(s.shareCopy, 500),
  }
}

// Job tokens. A paid write returns one; fix-up calls must present it, and
// the shared rate limiter counts fixes per job id, so a paid ad gets a
// bounded number of free revisions. Stateless: no table, no migration.
// Keyed off the service-role secret, which never leaves the server.
function tokenKey(): Buffer {
  return createHmac('sha256', 'motion-job-token').update(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').digest()
}

export function issueJobToken(userId: string): { jobId: string; token: string } {
  const jobId = randomUUID()
  const payload = Buffer.from(JSON.stringify({ u: userId, j: jobId, t: Date.now() })).toString('base64url')
  const sig = createHmac('sha256', tokenKey()).update(payload).digest('base64url')
  return { jobId, token: `${payload}.${sig}` }
}

/** The job id, if the token is genuine, belongs to this user and is under a day old. */
export function verifyJobToken(token: unknown, userId: string): string | null {
  if (typeof token !== 'string') return null
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const expected = createHmac('sha256', tokenKey()).update(payload).digest()
  const given = Buffer.from(sig, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const { u, j, t } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { u: string; j: string; t: number }
    if (u !== userId || Date.now() - t > 24 * 3600 * 1000) return null
    return j
  } catch {
    return null
  }
}
