import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [{ data: credits, error: creditsError }, { data: sub }] = await Promise.all([
      supabase.from('user_credits').select('balance, plan, monthly_credits, reset_date').eq('user_id', userData.user.id).single(),
      supabase.from('user_subscriptions').select('dodo_customer_id, status').eq('user_id', userData.user.id).maybeSingle(),
    ])

    if (creditsError || !credits) {
      return Response.json({ error: 'Credits not initialized' }, { status: 404 })
    }

    // A user is only "on a plan" if they have an ACTIVE Dodo subscription.
    // Cancelled / missing subscription → show as Free plan regardless of the
    // stale user_credits.plan value (which lingers from earlier tests).
    const hasActiveSub = !!(sub?.dodo_customer_id) && sub.status !== 'cancelled'
    const effectivePlan = hasActiveSub ? credits.plan : 'free'
    const effectiveMonthly = hasActiveSub ? credits.monthly_credits : 0

    return Response.json({
      balance: credits.balance,
      plan: effectivePlan,
      monthlyCredits: effectiveMonthly,
      resetDate: credits.reset_date,
      hasDodoSubscription: hasActiveSub,
    })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch credits' },
      { status: 500 }
    )
  }
}
