import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import DodoPayments from 'dodopayments'

export const maxDuration = 60

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

    const dodo = new DodoPayments({
      bearerToken: (process.env.DODO_ENV !== 'production' ? process.env.DODO_TEST_API_KEY : process.env.DODO_API_KEY)!,
      environment: process.env.DODO_ENV === 'production' ? 'live_mode' : 'test_mode',
    })

    // Find customer via stored id or email
    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('dodo_customer_id')
      .eq('user_id', userData.user.id)
      .maybeSingle()
    let customerId = sub?.dodo_customer_id
    if (!customerId && userData.user.email) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list = await dodo.customers.list({ email: userData.user.email } as any) as any
      const items: Array<{ customer_id?: string; email?: string }> = list?.items ?? list?.data ?? []
      customerId = items.find(c => c.email?.toLowerCase() === userData.user.email?.toLowerCase())?.customer_id ?? items[0]?.customer_id
    }
    if (!customerId) return NextResponse.json({ error: 'No Dodo customer found' }, { status: 404 })

    // List every active/pending sub for this customer and cancel each
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const active = await dodo.subscriptions.list({ customer_id: customerId, status: 'active' } as any) as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pending = await dodo.subscriptions.list({ customer_id: customerId, status: 'pending' } as any) as any
    const activeItems: Array<{ subscription_id: string }> = active?.items ?? active?.data ?? []
    const pendingItems: Array<{ subscription_id: string }> = pending?.items ?? pending?.data ?? []
    const all = [...activeItems, ...pendingItems]

    const results: Array<{ id: string; ok: boolean; err?: string }> = []
    for (const s of all) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await dodo.subscriptions.update(s.subscription_id, { status: 'cancelled' } as any)
        results.push({ id: s.subscription_id, ok: true })
      } catch (e) {
        results.push({ id: s.subscription_id, ok: false, err: e instanceof Error ? e.message : 'unknown' })
      }
    }

    // Mark our local record as cancelled
    await supabase.from('user_subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('user_id', userData.user.id)

    return NextResponse.json({ cancelled: results.filter(r => r.ok).length, total: all.length, results })
  } catch (err) {
    console.error('[dodo/cancel-all]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
