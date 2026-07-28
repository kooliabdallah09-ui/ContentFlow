import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { POLAR_PRODUCT_CREDIT_MAP } from '@/lib/polar'
import { sendCreditPackEmail } from '@/lib/email'

export const maxDuration = 60

// Svix webhook signature verification (Polar uses Svix under the hood).
// Secret format: whsec_<base64>
// Signed content: {webhook-id}\n{webhook-timestamp}\n{body}
// Signature header: v1,<base64_hmac_sha256>
function verifyPolarSignature(rawBody: string, req: NextRequest, secret: string): boolean {
  const msgId = req.headers.get('webhook-id')
  const msgTimestamp = req.headers.get('webhook-timestamp')
  const msgSignature = req.headers.get('webhook-signature')
  if (!msgId || !msgTimestamp || !msgSignature) return false

  // Reject timestamps older than 5 minutes
  const ts = parseInt(msgTimestamp, 10)
  if (isNaN(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const signedContent = `${msgId}\n${msgTimestamp}\n${rawBody}`
  const expectedSig = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64')

  return msgSignature.split(' ').some(sig => {
    const [version, value] = sig.split(',')
    if (version !== 'v1' || !value) return false
    try {
      return crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(value))
    } catch { return false }
  })
}

export async function POST(request: NextRequest) {
  const secret = process.env.POLAR_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 500 })

  const rawBody = await request.text()
  if (!verifyPolarSignature(rawBody, request, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody) as {
    type: string
    data: {
      id: string
      product_id: string
      metadata?: Record<string, string>
      customer?: { email?: string; name?: string }
    }
  }

  if (event.type !== 'order.created') {
    return NextResponse.json({ received: true, skipped: event.type })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Dedupe using the order ID
  const eventKey = `polar:${event.data.id}`
  const { error: dupErr } = await supabase
    .from('stripe_webhook_events')
    .insert({ event_id: eventKey, event_type: event.type })
  if (dupErr) return NextResponse.json({ received: true, duplicate: true })

  const userId = event.data.metadata?.supabase_user_id
  if (!userId) {
    console.warn('[polar/webhook] order.created missing supabase_user_id', event.data.id)
    return NextResponse.json({ received: true, skipped: 'no user' })
  }

  const creditsToAdd = POLAR_PRODUCT_CREDIT_MAP[event.data.product_id] ?? 0
  if (!creditsToAdd) {
    console.warn('[polar/webhook] unknown product_id', event.data.product_id)
    return NextResponse.json({ received: true, skipped: 'unknown product' })
  }

  try {
    const { data: current } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .single()

    await supabase.from('user_credits').update({
      balance: (current?.balance ?? 0) + creditsToAdd,
      pack_credits: (current?.pack_credits ?? 0) + creditsToAdd,
    }).eq('user_id', userId)

    // Email notification (fire-and-forget)
    const { data: authUser } = await supabase.auth.admin.getUserById(userId)
    const email = event.data.customer?.email ?? authUser.user?.email ?? ''
    const name = (authUser.user?.user_metadata?.full_name as string)
      ?? email.split('@')[0]
      ?? 'there'
    if (email) sendCreditPackEmail(email, name, creditsToAdd).catch(() => {})

    console.log(`[polar/webhook] +${creditsToAdd} credits → user ${userId}`)
  } catch (e) {
    console.error('[polar/webhook] handler error', e)
    await supabase.from('stripe_webhook_events').delete().eq('event_id', eventKey)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
