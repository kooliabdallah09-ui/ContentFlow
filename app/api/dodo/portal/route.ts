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

    const dodo = new DodoPayments({
      bearerToken: (process.env.DODO_ENV !== 'production' ? process.env.DODO_TEST_API_KEY : process.env.DODO_API_KEY)!,
      environment: process.env.DODO_ENV === 'production' ? 'live_mode' : 'test_mode',
    })

    let customerId = sub?.dodo_customer_id

    // Fall back 1: fetch customer_id from Dodo using subscription ID
    if (!customerId && sub?.dodo_subscription_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dodSub = await dodo.subscriptions.retrieve(sub.dodo_subscription_id) as any
      customerId = dodSub?.customer_id ?? null
      if (customerId) {
        await supabase.from('user_subscriptions').update({ dodo_customer_id: customerId }).eq('user_id', user.id)
      }
    }

    // Fall back 2: search Dodo customers by email
    if (!customerId && user.email) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const page = await dodo.customers.list({ email: user.email } as any) as any
        const items: Array<{ customer_id?: string; email?: string }> = page?.items ?? page?.data ?? []
        const found = items.find(c => c.email?.toLowerCase() === user.email?.toLowerCase()) ?? items[0]
        customerId = found?.customer_id ?? null
        if (customerId) {
          await supabase.from('user_subscriptions').upsert({
            user_id: user.id, dodo_customer_id: customerId, status: 'active', updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })
          console.log(`[dodo/portal] resolved customer via email ${user.email} → ${customerId}`)
        } else {
          console.warn(`[dodo/portal] no customer with email ${user.email} in Dodo (${items.length} results)`)
        }
      } catch (searchErr) {
        console.error('[dodo/portal] email search failed:', searchErr)
      }
    }

    if (!customerId) {
      return NextResponse.json({ error: `No Dodo customer found for ${user.email}. Contact support to link your account.` }, { status: 404 })
    }

    const session = await dodo.customers.customerPortal.create(customerId, {
      return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://contentflow-web.com'}/settings/billing`,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const url = (session as any).link ?? (session as any).url
    if (!url) return NextResponse.json({ error: 'Dodo portal session missing link' }, { status: 500 })
    return NextResponse.json({ url })
  } catch (err) {
    console.error('[dodo/portal] error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to create portal session'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
