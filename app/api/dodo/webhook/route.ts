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
      bearerToken: process.env.DODO_API_KEY!,
      webhookKey: process.env.DODO_WEBHOOK_SECRET!,
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
      const meta = (sub as any).metadata as Record<string, string> | undefined
      const userId = meta?.supabase_user_id
      const planKey = meta?.plan_key ?? 'starter'

      if (!userId) {
        console.warn('[dodo/webhook] subscription.active missing supabase_user_id', sub)
        return NextResponse.json({ ok: true })
      }

      const credits = PLAN_CREDITS[planKey] ?? 800

      // Upsert the user's subscription record and top up credits
      await Promise.all([
        supabase.from('user_subscriptions').upsert({
          user_id: userId,
          plan: planKey,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dodo_subscription_id: (sub as any).subscription_id ?? null,
          status: 'active',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' }),

        supabase.from('user_credits')
          .upsert({ user_id: userId, balance: credits, pack_credits: 0 }, { onConflict: 'user_id' }),
      ])

      console.log(`[dodo/webhook] activated ${planKey} for user ${userId} (${credits} cr)`)
    }

    if (event.type === 'subscription.renewed') {
      const sub = event.data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meta = (sub as any).metadata as Record<string, string> | undefined
      const userId = meta?.supabase_user_id
      const planKey = meta?.plan_key ?? 'starter'

      if (userId) {
        const credits = PLAN_CREDITS[planKey] ?? 800
        // Reset monthly credits (don't accumulate — overwrite balance)
        await supabase.from('user_credits')
          .update({ balance: credits, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
        console.log(`[dodo/webhook] renewed ${planKey} for user ${userId} (${credits} cr reset)`)
      }
    }

    if (event.type === 'subscription.cancelled') {
      const sub = event.data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meta = (sub as any).metadata as Record<string, string> | undefined
      const userId = meta?.supabase_user_id
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
