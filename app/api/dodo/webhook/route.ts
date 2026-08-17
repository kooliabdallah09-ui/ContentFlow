import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import DodoPayments from 'dodopayments'

export const maxDuration = 60

// Credits granted per plan per month
const PLAN_CREDITS: Record<string, number> = {
  lite:    300,
  starter: 800,
  pro:     2000,
  agency:  6500,
  enterprise: 25000,
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const headers: Record<string, string> = {}
  request.headers.forEach((v, k) => { headers[k] = v })

  try {
    const dodo = new DodoPayments({
      bearerToken: (process.env.DODO_ENV !== 'production' ? process.env.DODO_TEST_API_KEY : process.env.DODO_API_KEY)!,
      webhookKey: (process.env.DODO_ENV !== 'production' ? process.env.DODO_TEST_WEBHOOK_SECRET : process.env.DODO_WEBHOOK_SECRET)!,
      environment: process.env.DODO_ENV === 'production' ? 'live_mode' : 'test_mode',
    })

    const event = dodo.webhooks.unwrap(rawBody, { headers })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    if (event.type === 'subscription.active') {
      const sub = event.data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subAny = sub as any
      const meta = subAny.metadata as Record<string, string> | undefined
      let userId = meta?.supabase_user_id
      const planKey = meta?.plan_key ?? 'starter'

      // Portal-initiated changes have no metadata — fall back to customer_id lookup
      if (!userId && subAny.customer_id) {
        const { data: found } = await supabase
          .from('user_subscriptions')
          .select('user_id')
          .eq('dodo_customer_id', subAny.customer_id)
          .maybeSingle()
        userId = found?.user_id
      }

      if (!userId) {
        console.warn('[dodo/webhook] subscription.active: could not resolve user', subAny)
        return NextResponse.json({ ok: true })
      }

      const newCredits = PLAN_CREDITS[planKey] ?? 800

      // Check current balance so we don't wipe credits on downgrade
      const { data: existing } = await supabase
        .from('user_credits')
        .select('balance, pack_credits')
        .eq('user_id', userId)
        .maybeSingle()

      const currentBalance = existing?.balance ?? 0
      // On upgrade: give the new (higher) allocation. On downgrade: keep existing balance.
      const newBalance = newCredits > currentBalance ? newCredits : currentBalance

      await Promise.all([
        supabase.from('user_subscriptions').upsert({
          user_id: userId,
          plan: planKey,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dodo_subscription_id: (sub as any).subscription_id ?? null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dodo_customer_id: (sub as any).customer_id ?? null,
          status: 'active',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' }),

        supabase.from('user_credits')
          .upsert({ user_id: userId, balance: newBalance, pack_credits: existing?.pack_credits ?? 0 }, { onConflict: 'user_id' }),
      ])

      console.log(`[dodo/webhook] activated ${planKey} for user ${userId} (balance: ${currentBalance} → ${newBalance} cr)`)
    }

    if (event.type === 'subscription.renewed') {
      const sub = event.data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subAny = sub as any
      const meta = subAny.metadata as Record<string, string> | undefined
      let userId = meta?.supabase_user_id
      const planKey = meta?.plan_key ?? 'starter'

      if (!userId && subAny.customer_id) {
        const { data: found } = await supabase.from('user_subscriptions').select('user_id').eq('dodo_customer_id', subAny.customer_id).maybeSingle()
        userId = found?.user_id
      }

      if (userId) {
        const credits = PLAN_CREDITS[planKey] ?? 800
        await supabase.from('user_credits')
          .update({ balance: credits, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
        console.log(`[dodo/webhook] renewed ${planKey} for user ${userId} (${credits} cr reset)`)
      }
    }

    if (event.type === 'subscription.cancelled') {
      const sub = event.data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subAny = sub as any
      const meta = subAny.metadata as Record<string, string> | undefined
      let userId = meta?.supabase_user_id

      if (!userId && subAny.customer_id) {
        const { data: found } = await supabase.from('user_subscriptions').select('user_id').eq('dodo_customer_id', subAny.customer_id).maybeSingle()
        userId = found?.user_id
      }

      if (userId) {
        await supabase.from('user_subscriptions')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('user_id', userId)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[dodo/webhook] failed:', err)
    return NextResponse.json({ error: 'Webhook handling failed' }, { status: 400 })
  }
}
