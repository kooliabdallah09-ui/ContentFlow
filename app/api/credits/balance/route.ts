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

    const { data: credits, error: creditsError } = await supabase
      .from('user_credits')
      .select('balance, plan, monthly_credits, reset_date')
      .eq('user_id', userData.user.id)
      .single()

    if (creditsError || !credits) {
      return Response.json({ error: 'Credits not initialized' }, { status: 404 })
    }

    return Response.json({
      balance: credits.balance,
      plan: credits.plan,
      monthlyCredits: credits.monthly_credits,
      resetDate: credits.reset_date,
    })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch credits' },
      { status: 500 }
    )
  }
}
