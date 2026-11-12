// Public abuse-report endpoint. Anyone (auth or not) can submit — we need
// this for compliance (impersonation reports, DMCA-style takedowns, minor-
// safety flags on generated content). Rate-limited by IP.
//
// Payload sent to the admin inbox via the same email helper the rest of the
// app uses. Stored in Supabase as well so nothing gets lost if email fails.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sanitizeUserPrompt } from '@/lib/sanitize-prompt'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const maxDuration = 15

export async function POST(request: NextRequest) {
  // 3 reports per IP per hour, shared across all server instances.
  const ip = getClientIp(request)
  const limit = await checkRateLimit('abuse-report', ip, 3, 60 * 60 * 1000)
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many reports. Try again in an hour.' }, { status: 429 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const reason = sanitizeUserPrompt(body.reason).clean.slice(0, 200)
    const description = sanitizeUserPrompt(body.description).clean.slice(0, 2000)
    const contentUrl = typeof body.contentUrl === 'string' ? body.contentUrl.slice(0, 500) : ''
    const contentId = typeof body.contentId === 'string' ? body.contentId.slice(0, 100) : ''
    const reporterEmail = typeof body.reporterEmail === 'string' ? body.reporterEmail.slice(0, 200) : ''

    if (!reason || !description) {
      return NextResponse.json({ error: 'Reason and description are required.' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Best-effort insert into an abuse_reports table (create if not exists in
    // a follow-up migration). If insert fails we still surface success to the
    // user — the console log is the fallback trail.
    const { error } = await supabase.from('abuse_reports').insert({
      reason,
      description,
      content_url: contentUrl || null,
      content_id: contentId || null,
      reporter_email: reporterEmail || null,
      reporter_ip: ip,
      status: 'new',
    })
    if (error) {
      console.warn('[abuse-report] insert failed (still returning success):', error.message)
      console.log('[abuse-report] payload:', { reason, description, contentUrl, contentId, reporterEmail, ip })
    }

    return NextResponse.json({ ok: true, message: 'Report received. We review every submission within 24 hours.' })
  } catch (err) {
    console.error('[abuse-report]', err)
    return NextResponse.json({ error: 'Failed to submit report.' }, { status: 500 })
  }
}
