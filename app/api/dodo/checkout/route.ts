import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import DodoPayments from 'dodopayments'

export const maxDuration = 30

// Map plan keys to Dodo product IDs — prefix switches between test and live sets
const isTest = process.env.DODO_ENV !== 'production'
const p = (live: string, test: string) => (isTest ? process.env[test] : process.env[live]) ?? ''

const DODO_PRODUCTS: Record<string, { monthly: string; annual: string }> = {
  lite:       { monthly: p('DODO_PRODUCT_LITE_MONTHLY',       'DODO_TEST_PRODUCT_LITE_MONTHLY'),       annual: p('DODO_PRODUCT_LITE_ANNUAL',       'DODO_TEST_PRODUCT_LITE_ANNUAL') },
  starter:    { monthly: p('DODO_PRODUCT_STARTER_MONTHLY',    'DODO_TEST_PRODUCT_STARTER_MONTHLY'),    annual: p('DODO_PRODUCT_STARTER_ANNUAL',    'DODO_TEST_PRODUCT_STARTER_ANNUAL') },
  pro:        { monthly: p('DODO_PRODUCT_PRO_MONTHLY',        'DODO_TEST_PRODUCT_PRO_MONTHLY'),        annual: p('DODO_PRODUCT_PRO_ANNUAL',        'DODO_TEST_PRODUCT_PRO_ANNUAL') },
  agency:     { monthly: p('DODO_PRODUCT_AGENCY_MONTHLY',     'DODO_TEST_PRODUCT_AGENCY_MONTHLY'),     annual: p('DODO_PRODUCT_AGENCY_ANNUAL',     'DODO_TEST_PRODUCT_AGENCY_ANNUAL') },
  enterprise: { monthly: p('DODO_PRODUCT_ENTERPRISE_MONTHLY', 'DODO_TEST_PRODUCT_ENTERPRISE_MONTHLY'), annual: p('DODO_PRODUCT_ENTERPRISE_ANNUAL', 'DODO_TEST_PRODUCT_ENTERPRISE_ANNUAL') },
  // Credit packs (one-time, annual unused)
  pack_250:  { monthly: p('DODO_PACK_250',  'DODO_TEST_PACK_250'),  annual: '' },
  pack_500:  { monthly: p('DODO_PACK_500',  'DODO_TEST_PACK_500'),  annual: '' },
  pack_1500: { monthly: p('DODO_PACK_1500', 'DODO_TEST_PACK_1500'), annual: '' },
  pack_5000: { monthly: p('DODO_PACK_5000', 'DODO_TEST_PACK_5000'), annual: '' },
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

    const { planKey, annual } = await request.json() as { planKey: string; annual?: boolean }
    const plan = DODO_PRODUCTS[planKey]
    if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

    const productId = annual ? plan.annual : plan.monthly
    if (!productId) {
      return NextResponse.json({ error: 'Plan not configured yet — try again soon.' }, { status: 503 })
    }

    const dodo = new DodoPayments({
      bearerToken: (isTest ? process.env.DODO_TEST_API_KEY : process.env.DODO_API_KEY)!,
      environment: process.env.DODO_ENV === 'production' ? 'live_mode' : 'test_mode',
    })

    // If this is a subscription plan (not a one-time pack), cancel any existing active
    // subscription for this user so they aren't double-charged after upgrading.
    const isPackPurchase = planKey.startsWith('pack_')
    if (!isPackPurchase) {
      const { data: existingSub } = await supabase
        .from('user_subscriptions')
        .select('dodo_subscription_id, dodo_customer_id, status')
        .eq('user_id', userData.user.id)
        .maybeSingle()
      if (existingSub?.dodo_subscription_id && existingSub.status !== 'cancelled') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          // Cancel at period end so annual subscribers don't lose prepaid time.
          // Monthly subscribers effectively get the same behaviour (cancel takes effect at next billing).
          await dodo.subscriptions.update(existingSub.dodo_subscription_id, { cancel_at_next_billing_date: true } as any)
          console.log(`[dodo/checkout] cancelled prior sub ${existingSub.dodo_subscription_id} for user ${userData.user.id}`)
        } catch (cancelErr) {
          console.warn(`[dodo/checkout] could not cancel prior sub ${existingSub.dodo_subscription_id}:`, cancelErr)
        }
      }
      // Also fetch any other active subs for this customer (in case there were multiple from earlier bugs)
      if (existingSub?.dodo_customer_id) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const subs = await dodo.subscriptions.list({ customer_id: existingSub.dodo_customer_id, status: 'active' } as any) as any
          const items: Array<{ subscription_id: string }> = subs?.items ?? subs?.data ?? []
          for (const s of items) {
            if (s.subscription_id === existingSub.dodo_subscription_id) continue
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await dodo.subscriptions.update(s.subscription_id, { cancel_at_next_billing_date: true } as any)
              console.log(`[dodo/checkout] also cancelled stray sub ${s.subscription_id}`)
            } catch { /* ignore individual failures */ }
          }
        } catch (listErr) {
          console.warn('[dodo/checkout] stray-sub sweep failed:', listErr)
        }
      }
    }

    const origin = request.headers.get('origin') ?? 'https://contentflow-web.com'
    const session = await dodo.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: {
        email: userData.user.email ?? '',
        name: userData.user.user_metadata?.full_name ?? userData.user.email ?? '',
      },
      return_url: `${origin}/dashboard?payment=success&plan=${planKey}`,
      cancel_url: `${origin}/pricing`,
      // Pass Supabase user ID so the webhook can find the right user
      metadata: { supabase_user_id: userData.user.id, plan_key: planKey },
    })

    return NextResponse.json({ url: (session as { checkout_url?: string }).checkout_url })
  } catch (err) {
    console.error('[dodo/checkout]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Checkout failed' }, { status: 500 })
  }
}
