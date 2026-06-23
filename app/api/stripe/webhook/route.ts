import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { stripe, PLAN_PRICE_MAP, PACK_CREDIT_MAP } from '@/lib/stripe'
import Stripe from 'stripe'

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

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = (session.metadata?.supabase_user_id) ??
          await getUserIdByCustomer(supabase, session.customer as string)
        if (!userId) break

        if (session.mode === 'subscription') {
          // Get the price ID from the line items
          const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ['line_items'],
          })
          const priceId = fullSession.line_items?.data[0]?.price?.id ?? ''
          const planInfo = PLAN_PRICE_MAP[priceId]
          if (planInfo) {
            const resetDate = new Date()
            resetDate.setMonth(resetDate.getMonth() + 1)
            await supabase
              .from('user_credits')
              .update({
                plan: planInfo.plan,
                monthly_credits: planInfo.monthly_credits,
                balance: planInfo.monthly_credits,
                reset_date: resetDate.toISOString(),
                stripe_customer_id: session.customer as string,
              })
              .eq('user_id', userId)
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
              .select('balance')
              .eq('user_id', userId)
              .single()
            await supabase
              .from('user_credits')
              .update({ balance: (current?.balance ?? 0) + creditsToAdd })
              .eq('user_id', userId)
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

        const resetDate = new Date()
        resetDate.setMonth(resetDate.getMonth() + 1)
        resetDate.setDate(1)
        await supabase
          .from('user_credits')
          .update({
            balance: planInfo.monthly_credits,
            monthly_credits: planInfo.monthly_credits,
            reset_date: resetDate.toISOString(),
          })
          .eq('user_id', userId)
        break
      }
    }
  } catch (e) {
    console.error('[stripe/webhook] handler error', e)
  }

  return NextResponse.json({ received: true })
}
