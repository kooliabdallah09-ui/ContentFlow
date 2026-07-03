import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { stripe, PLAN_PRICE_MAP, PACK_CREDIT_MAP } from '@/lib/stripe'
import Stripe from 'stripe'
import { sendSubscriptionEmail, sendCreditPackEmail, sendCreditsRenewedEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = SupabaseClient<any, any, any>

function getSupabase(): Supa {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getUserIdByCustomer(supabase: Supa, customerId: string): Promise<string | null> {
  const { data } = await supabase
    .from('user_credits')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any)?.user_id ?? null
}

async function getUserEmailAndName(supabase: Supa, userId: string): Promise<{ email: string; name: string }> {
  try {
    const { data } = await supabase.auth.admin.getUserById(userId)
    return {
      email: data.user?.email ?? '',
      name: data.user?.user_metadata?.full_name ?? '',
    }
  } catch {
    return { email: '', name: '' }
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })

  const sig = request.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (e) {
    console.error('[stripe/webhook] signature failed', e)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Idempotency guard: reject duplicate deliveries so credits can't double-apply.
  const { error: dedupError } = await supabase
    .from('stripe_webhook_events')
    .insert({ event_id: event.id, event_type: event.type })
  if (dedupError) {
    // Unique violation = already processed. Any other error = fail so Stripe retries.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((dedupError as any).code === '23505') {
      return NextResponse.json({ received: true, duplicate: true })
    }
    console.error('[stripe/webhook] dedup insert failed', dedupError)
    return NextResponse.json({ error: 'dedup failed' }, { status: 500 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = (session.metadata?.supabase_user_id) ??
          await getUserIdByCustomer(supabase, session.customer as string)
        if (!userId) break

        if (session.mode === 'subscription') {
          const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ['line_items'],
          })
          const priceId = fullSession.line_items?.data[0]?.price?.id ?? ''
          const planInfo = PLAN_PRICE_MAP[priceId]
          if (planInfo) {
            const { data: current } = await supabase
              .from('user_credits')
              .select('plan, balance, pack_credits, monthly_credits')
              .eq('user_id', userId)
              .single()

            const isNewSubscription = !current?.plan || current.plan === 'free'
            const packCredits = current?.pack_credits ?? 0
            const currentBalance = current?.balance ?? 0
            const currentMonthly = current?.monthly_credits ?? 0
            const isUpgrade = planInfo.monthly_credits > currentMonthly
            const resetDate = new Date()
            resetDate.setMonth(resetDate.getMonth() + 1)

            let newBalance: number
            if (isNewSubscription || isUpgrade) {
              // New sub or upgrade: reset to full new monthly allowance + pack credits
              newBalance = planInfo.monthly_credits + packCredits
            } else {
              // Downgrade: keep current balance and add the new plan's credits on top
              newBalance = currentBalance + planInfo.monthly_credits
            }

            await supabase
              .from('user_credits')
              .update({
                plan: planInfo.plan,
                monthly_credits: planInfo.monthly_credits,
                balance: newBalance,
                reset_date: resetDate.toISOString(),
                stripe_customer_id: session.customer as string,
              })
              .eq('user_id', userId)
            const { email, name } = await getUserEmailAndName(supabase, userId)
            if (email) sendSubscriptionEmail(email, name, planInfo.plan, planInfo.monthly_credits).catch(() => {})
          }
        } else if (session.mode === 'payment') {
          const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ['line_items'],
          })
          const priceId = fullSession.line_items?.data[0]?.price?.id ?? ''
          const creditsToAdd = PACK_CREDIT_MAP[priceId]
          if (creditsToAdd) {
            const { data: current } = await supabase
              .from('user_credits')
              .select('balance, pack_credits')
              .eq('user_id', userId)
              .single()
            await supabase
              .from('user_credits')
              .update({
                balance: (current?.balance ?? 0) + creditsToAdd,
                pack_credits: (current?.pack_credits ?? 0) + creditsToAdd,
              })
              .eq('user_id', userId)
            const { email, name } = await getUserEmailAndName(supabase, userId)
            if (email) sendCreditPackEmail(email, name, creditsToAdd).catch(() => {})
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = await getUserIdByCustomer(supabase, sub.customer as string)
        if (userId) {
          await supabase
            .from('user_credits')
            .update({ plan: 'free', monthly_credits: 0 })
            .eq('user_id', userId)
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const priceId = sub.items.data[0]?.price?.id ?? ''
        const planInfo = PLAN_PRICE_MAP[priceId]
        if (!planInfo) break
        const userId = await getUserIdByCustomer(supabase, sub.customer as string)
        if (userId) {
          await supabase
            .from('user_credits')
            .update({ plan: planInfo.plan, monthly_credits: planInfo.monthly_credits })
            .eq('user_id', userId)
        }
        break
      }

      // Fires on every successful renewal payment — this is how monthly credits are topped up.
      case 'invoice.paid': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any
        // Only handle subscription invoices (not one-off credit pack payments)
        const subscriptionId: string | null = invoice.subscription ?? invoice.parent?.subscription_details?.subscription ?? null
        if (!subscriptionId) break
        // Skip the very first invoice — checkout.session.completed already handled it
        if (invoice.billing_reason === 'subscription_create') break

        const sub = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = sub.items.data[0]?.price?.id ?? ''
        const planInfo = PLAN_PRICE_MAP[priceId]
        if (!planInfo) break

        const userId = await getUserIdByCustomer(supabase, invoice.customer as string)
        if (!userId) break

        // pack_credits is always accurate (deductCredits keeps it in sync),
        // so just restore monthly allowance on top of remaining pack credits.
        const { data: currentCredits } = await supabase
          .from('user_credits')
          .select('pack_credits')
          .eq('user_id', userId)
          .single()
        const packCredits = currentCredits?.pack_credits ?? 0

        const resetDate = new Date()
        resetDate.setMonth(resetDate.getMonth() + 1)
        resetDate.setDate(1)
        await supabase
          .from('user_credits')
          .update({
            balance: planInfo.monthly_credits + packCredits,
            monthly_credits: planInfo.monthly_credits,
            reset_date: resetDate.toISOString(),
          })
          .eq('user_id', userId)
        const { email, name } = await getUserEmailAndName(supabase, userId)
        if (email) sendCreditsRenewedEmail(email, name, planInfo.monthly_credits, planInfo.plan).catch(() => {})
        break
      }
    }
  } catch (e) {
    console.error('[stripe/webhook] handler error', e)
    // Roll back dedup row so Stripe's retry can reprocess this event.
    await supabase.from('stripe_webhook_events').delete().eq('event_id', event.id)
    return NextResponse.json({ error: 'handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
