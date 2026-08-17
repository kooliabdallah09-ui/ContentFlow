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
      bearerToken: process.env.DODO_API_KEY!,
      environment: process.env.DODO_ENV === 'production' ? 'live_mode' : 'test_mode',
    })

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
