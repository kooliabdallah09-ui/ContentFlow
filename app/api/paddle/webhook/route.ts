// Paddle webhook — mirrors the Stripe webhook's credit logic on Paddle's
// event model:
//   transaction.completed (origin web)                    → initial plan purchase or credit pack
//   transaction.completed (origin subscription_recurring) → monthly renewal top-up
//   subscription.updated / .canceled                      → plan metadata changes
// Users are linked via custom_data.supabase_user_id set at checkout
// (Paddle propagates it to the subscription and its renewal transactions).

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { PADDLE_PLAN_PRICE_MAP, PADDLE_PACK_CREDIT_MAP } from '@/lib/paddle'
import { sendSubscriptionEmail, sendCreditPackEmail, sendCreditsRenewedEmail } from '@/lib/email'

export const maxDuration = 60

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = SupabaseClient<any, any, any>

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false
  const parts = Object.fromEntries(header.split(';').map(p => p.split('=') as [string, string]))
  const ts = parts['ts']
  const h1 = parts['h1']
  if (!ts || !h1) return false
  const expected = crypto.createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(h1))
  } catch { return false }
}

async function getUserEmailAndName(supabase: Supa, userId: string): Promise<{ email: string; name: string }> {
  const { data } = await supabase.auth.admin.getUserById(userId)
  const email = data.user?.email ?? ''
  const name = (data.user?.user_metadata?.full_name as string) ?? email.split('@')[0] ?? 'there'
  return { email, name }
}

export async function POST(request: NextRequest) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 500 })

  const rawBody = await request.text()
  if (!verifySignature(rawBody, request.headers.get('Paddle-Signature'), secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody) as {
    event_id: string
    event_type: string
    data: {
      id: string
      origin?: string
      custom_data?: { supabase_user_id?: string }
      items?: Array<{ price?: { id?: string }; quantity?: number }>
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Dedupe (reuses the Stripe events table — event IDs never collide).
  const { error: dupErr } = await supabase
    .from('stripe_webhook_events')
    .insert({ event_id: event.event_id, event_type: event.event_type })
  if (dupErr) return NextResponse.json({ received: true, duplicate: true })

  const userId = event.data.custom_data?.supabase_user_id
  if (!userId) return NextResponse.json({ received: true, skipped: 'no user' })

  try {
    switch (event.event_type) {
      case 'transaction.completed': {
        const lineItems = (event.data.items ?? [])
          .map(i => ({ priceId: i.price?.id, quantity: Math.max(1, Number(i.quantity) || 1) }))
          .filter((x): x is { priceId: string; quantity: number } => !!x.priceId)
        const isRenewal = event.data.origin === 'subscription_recurring'

        for (const { priceId, quantity } of lineItems) {
          const packCreditsToAdd = (PADDLE_PACK_CREDIT_MAP[priceId] ?? 0) * quantity
          const planInfo = PADDLE_PLAN_PRICE_MAP[priceId]

          if (packCreditsToAdd) {
            const { data: current } = await supabase
              .from('user_credits')
              .select('balance, pack_credits')
              .eq('user_id', userId)
              .single()
            await supabase.from('user_credits').update({
              balance: (current?.balance ?? 0) + packCreditsToAdd,
              pack_credits: (current?.pack_credits ?? 0) + packCreditsToAdd,
            }).eq('user_id', userId)
            const { email, name } = await getUserEmailAndName(supabase, userId)
            if (email) sendCreditPackEmail(email, name, packCreditsToAdd).catch(() => {})
          } else if (planInfo) {
            const { data: current } = await supabase
              .from('user_credits')
              .select('plan, balance, pack_credits, monthly_credits')
              .eq('user_id', userId)
              .single()
            const packCredits = current?.pack_credits ?? 0
            const resetDate = new Date()
            resetDate.setMonth(resetDate.getMonth() + 1)

            let newBalance: number
            if (isRenewal) {
              // Renewal: restore monthly allowance on top of remaining pack credits.
              newBalance = planInfo.monthly_credits + packCredits
            } else {
              const isNewSubscription = !current?.plan || current.plan === 'free'
              const isUpgrade = planInfo.monthly_credits > (current?.monthly_credits ?? 0)
              newBalance = (isNewSubscription || isUpgrade)
                ? planInfo.monthly_credits + packCredits
                : (current?.balance ?? 0) + planInfo.monthly_credits
            }

            await supabase.from('user_credits').update({
              plan: planInfo.plan,
              monthly_credits: planInfo.monthly_credits,
              balance: newBalance,
              reset_date: resetDate.toISOString(),
            }).eq('user_id', userId)

            const { email, name } = await getUserEmailAndName(supabase, userId)
            if (email) {
              if (isRenewal) sendCreditsRenewedEmail(email, name, planInfo.monthly_credits, planInfo.plan).catch(() => {})
              else sendSubscriptionEmail(email, name, planInfo.plan, planInfo.monthly_credits).catch(() => {})
            }
          }
        }
        break
      }

      case 'subscription.canceled': {
        await supabase
          .from('user_credits')
          .update({ plan: 'free', monthly_credits: 0 })
          .eq('user_id', userId)
        break
      }

      case 'subscription.updated': {
        const priceId = event.data.items?.[0]?.price?.id ?? ''
        const planInfo = PADDLE_PLAN_PRICE_MAP[priceId]
        if (planInfo) {
          await supabase
            .from('user_credits')
            .update({ plan: planInfo.plan, monthly_credits: planInfo.monthly_credits })
            .eq('user_id', userId)
        }
        break
      }
    }
  } catch (e) {
    console.error('[paddle/webhook] handler error', e)
    // Roll back dedup row so Paddle's retry can reprocess this event.
    await supabase.from('stripe_webhook_events').delete().eq('event_id', event.event_id)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
