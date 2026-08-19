// Manual "Resync my plan" endpoint. Users hit this if a webhook was missed
// (Dodo outage, endpoint downtime >5d, etc.) and their credits didn't reset
// after a monthly renewal. Safe to call at any time — never double-credits.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import DodoPayments from 'dodopayments'

export const maxDuration = 30

const PLAN_CREDITS: Record<string, number> = {
  lite:    300,
  starter: 800,
  pro:     2000,
  agency:  6500,
  enterprise: 25000,
}

// Build reverse map: Dodo product_id → plan_key (respects test/live env)
function getProductIdToPlanKey(): Record<string, string> {
  const isTest = process.env.DODO_ENV !== 'production'
  const map: Record<string, string> = {}
  for (const planKey of Object.keys(PLAN_CREDITS)) {
    for (const period of ['MONTHLY', 'ANNUAL']) {
      const envKey = isTest
        ? `DODO_TEST_PRODUCT_${planKey.toUpperCase()}_${period}`
        : `DODO_PRODUCT_${planKey.toUpperCase()}_${period}`
      const productId = process.env[envKey]
      if (productId) map[productId] = planKey
    }
  }
  return map
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = userData.user.id

    const dodo = new DodoPayments({
      bearerToken: (process.env.DODO_ENV !== 'production' ? process.env.DODO_TEST_API_KEY : process.env.DODO_API_KEY)!,
      environment: process.env.DODO_ENV === 'production' ? 'live_mode' : 'test_mode',
    })

    // Find Dodo customer for this user
    const { data: existingSub } = await supabase
      .from('user_subscriptions')
      .select('dodo_customer_id')
      .eq('user_id', userId)
      .maybeSingle()
    let customerId = existingSub?.dodo_customer_id
    if (!customerId && userData.user.email) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list = await dodo.customers.list({ email: userData.user.email } as any) as any
      const items: Array<{ customer_id?: string; email?: string }> = list?.items ?? list?.data ?? []
      customerId = items.find(c => c.email?.toLowerCase() === userData.user.email?.toLowerCase())?.customer_id ?? items[0]?.customer_id
    }
    if (!customerId) {
      return NextResponse.json({ status: 'no-subscription', message: 'No Dodo customer found for this account.' })
    }

    // Find the active subscription for this customer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeList = await dodo.subscriptions.list({ customer_id: customerId, status: 'active' } as any) as any
    const items: Array<{ subscription_id: string; product_id?: string }> = activeList?.items ?? activeList?.data ?? []
    if (!items.length) {
      // No active sub — reflect that in our DB so the UI shows Free
      await supabase.from('user_subscriptions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('user_id', userId)
      return NextResponse.json({ status: 'no-active-sub', message: 'No active subscription found on Dodo. Your account has been reset to Free plan.' })
    }
    const activeSub = items[0]

    // Resolve plan from product_id
    const productMap = getProductIdToPlanKey()
    const planKey = activeSub.product_id ? productMap[activeSub.product_id] : undefined
    if (!planKey || !PLAN_CREDITS[planKey]) {
      return NextResponse.json({
        status: 'unknown-plan',
        message: `Subscription found (${activeSub.subscription_id}) but its product_id doesn't map to a known plan. Contact support.`,
      }, { status: 500 })
    }
    const monthlyCredits = PLAN_CREDITS[planKey]

    // Safely top up: if current balance is below the plan's monthly allocation,
    // bring it up to at least that. Never subtract or double-credit.
    const { data: credits } = await supabase
      .from('user_credits').select('balance, pack_credits').eq('user_id', userId).maybeSingle()
    const currentBalance = credits?.balance ?? 0
    const packCredits = credits?.pack_credits ?? 0
    const targetMinBalance = monthlyCredits + packCredits
    const newBalance = Math.max(currentBalance, targetMinBalance)

    await Promise.all([
      supabase.from('user_subscriptions').upsert({
        user_id: userId,
        plan: planKey,
        dodo_subscription_id: activeSub.subscription_id,
        dodo_customer_id: customerId,
        status: 'active',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }),
      supabase.from('user_credits').update({
        balance: newBalance,
        plan: planKey,
        monthly_credits: monthlyCredits,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId),
    ])

    return NextResponse.json({
      status: 'synced',
      plan: planKey,
      monthlyCredits,
      balance: newBalance,
      wasToppedUp: newBalance > currentBalance,
      addedCredits: newBalance - currentBalance,
    })
  } catch (err) {
    console.error('[dodo/resync]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Resync failed' }, { status: 500 })
  }
}
