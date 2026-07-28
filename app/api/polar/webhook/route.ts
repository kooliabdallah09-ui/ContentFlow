import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { POLAR_PACK_CREDIT_MAP, POLAR_PLAN_MAP } from '@/lib/polar'
import { sendCreditPackEmail, sendSubscriptionEmail, sendCreditsRenewedEmail } from '@/lib/email'

export const maxDuration = 60

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = SupabaseClient<any, any, any>

// Svix webhook signature verification (Polar uses Svix).
// Secret format: whsec_<base64>
// Signed content: {webhook-id}\n{webhook-timestamp}\n{body}
function verifyPolarSignature(rawBody: string, req: NextRequest, secret: string): boolean {
  const msgId = req.headers.get('webhook-id')
  const msgTimestamp = req.headers.get('webhook-timestamp')
  const msgSignature = req.headers.get('webhook-signature')
  if (!msgId || !msgTimestamp || !msgSignature) return false

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

async function getUserMeta(supabase: Supa, userId: string) {
  const { data } = await supabase.auth.admin.getUserById(userId)
  const email = data.user?.email ?? ''
  const name = (data.user?.user_metadata?.full_name as string) ?? email.split('@')[0] ?? 'there'
  return { email, name }
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
      product_id?: string
      metadata?: Record<string, string>
      customer?: { email?: string; name?: string }
      current_period_start?: string
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const HANDLED = ['order.created', 'subscription.created', 'subscription.cycled', 'subscription.revoked']
  if (!HANDLED.includes(event.type)) {
    return NextResponse.json({ received: true, skipped: event.type })
  }

  // Dedupe
  const eventKey = `polar:${event.data.id}:${event.type}`
  const { error: dupErr } = await supabase
    .from('stripe_webhook_events')
    .insert({ event_id: eventKey, event_type: event.type })
  if (dupErr) return NextResponse.json({ received: true, duplicate: true })

  const userId = event.data.metadata?.supabase_user_id
  if (!userId) {
    console.warn('[polar/webhook] missing supabase_user_id', event.type, event.data.id)
    return NextResponse.json({ received: true, skipped: 'no user' })
  }

  const productId = event.data.product_id ?? ''

  try {
    switch (event.type) {
      case 'order.created': {
        const creditsToAdd = POLAR_PACK_CREDIT_MAP[productId] ?? 0
        if (!creditsToAdd) {
          // Could be a subscription order — handled by subscription.created
          return NextResponse.json({ received: true, skipped: 'subscription order handled separately' })
        }
        const { data: current } = await supabase
          .from('user_credits')
          .select('balance, pack_credits')
          .eq('user_id', userId)
          .single()
        await supabase.from('user_credits').update({
          balance: (current?.balance ?? 0) + creditsToAdd,
          pack_credits: (current?.pack_credits ?? 0) + creditsToAdd,
        }).eq('user_id', userId)
        const { email, name } = await getUserMeta(supabase, userId)
        if (email) sendCreditPackEmail(email, name, creditsToAdd).catch(() => {})
        console.log(`[polar/webhook] pack +${creditsToAdd}cr → user ${userId}`)
        break
      }

      case 'subscription.created': {
        const planInfo = POLAR_PLAN_MAP[productId]
        if (!planInfo) break
        const { data: current } = await supabase
          .from('user_credits')
          .select('balance, pack_credits, monthly_credits')
          .eq('user_id', userId)
          .single()
        const packCredits = current?.pack_credits ?? 0
        const isUpgrade = planInfo.monthly_credits > (current?.monthly_credits ?? 0)
        const newBalance = isUpgrade
          ? planInfo.monthly_credits + packCredits
          : (current?.balance ?? 0) + planInfo.monthly_credits
        const resetDate = new Date()
        resetDate.setMonth(resetDate.getMonth() + 1)
        await supabase.from('user_credits').update({
          plan: planInfo.plan,
          monthly_credits: planInfo.monthly_credits,
          balance: newBalance,
          reset_date: resetDate.toISOString(),
        }).eq('user_id', userId)
        const { email, name } = await getUserMeta(supabase, userId)
        if (email) sendSubscriptionEmail(email, name, planInfo.plan, planInfo.monthly_credits).catch(() => {})
        console.log(`[polar/webhook] sub created ${planInfo.plan} → user ${userId}`)
        break
      }

      case 'subscription.cycled': {
        const planInfo = POLAR_PLAN_MAP[productId]
        if (!planInfo) break
        const { data: current } = await supabase
          .from('user_credits')
          .select('pack_credits')
          .eq('user_id', userId)
          .single()
        const packCredits = current?.pack_credits ?? 0
        const resetDate = new Date()
        resetDate.setMonth(resetDate.getMonth() + 1)
        await supabase.from('user_credits').update({
          balance: planInfo.monthly_credits + packCredits,
          reset_date: resetDate.toISOString(),
        }).eq('user_id', userId)
        const { email, name } = await getUserMeta(supabase, userId)
        if (email) sendCreditsRenewedEmail(email, name, planInfo.monthly_credits, planInfo.plan).catch(() => {})
        console.log(`[polar/webhook] sub cycled ${planInfo.plan} → user ${userId}`)
        break
      }

      case 'subscription.revoked': {
        await supabase.from('user_credits')
          .update({ plan: 'free', monthly_credits: 0 })
          .eq('user_id', userId)
        console.log(`[polar/webhook] sub revoked → user ${userId} → free`)
        break
      }
    }
  } catch (e) {
    console.error('[polar/webhook] handler error', e)
    await supabase.from('stripe_webhook_events').delete().eq('event_id', eventKey)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
