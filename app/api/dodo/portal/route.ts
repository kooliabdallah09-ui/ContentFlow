import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import DodoPayments from 'dodopayments'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const user = userData.user

    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('dodo_customer_id, dodo_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!sub) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    const dodo = new DodoPayments({
      bearerToken: process.env.DODO_API_KEY!,
      environment: process.env.DODO_ENV === 'production' ? 'live_mode' : 'test_mode',
    })

    // Fall back to fetching customer_id from Dodo using the subscription ID
    let customerId = sub.dodo_customer_id
    if (!customerId && sub.dodo_subscription_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dodSub = await dodo.subscriptions.retrieve(sub.dodo_subscription_id) as any
      customerId = dodSub?.customer_id ?? null
      // Backfill so future calls don't need the lookup
      if (customerId) {
        await supabase.from('user_subscriptions')
          .update({ dodo_customer_id: customerId })
          .eq('user_id', user.id)
      }
    }

    if (!customerId) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    const session = await dodo.customers.customerPortal.create(customerId, {
      return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://contentflow-web.com'}/settings/billing`,
    })

    return NextResponse.json({ url: (session as any).url })
  } catch (err) {
    console.error('[dodo/portal] error:', err)
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 })
  }
}
