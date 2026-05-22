import { createClient } from '@supabase/supabase-js'
import { initializeUserCredits } from '@/lib/credits'

export async function POST(request: Request) {
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

    const { plan = 'free' } = await request.json()

    // Check if credits already initialized
    const { data: existingCredits, error: checkError } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userData.user.id)
      .single()

    if (existingCredits) {
      return Response.json({ message: 'Credits already initialized', data: existingCredits })
    }

    // Initialize credits directly on server
    const PLAN_CREDITS: any = {
      free: { monthly: 50, signup_bonus: 150 },
      starter: { monthly: 1000 },
      pro: { monthly: 4000 },
      agency: { monthly: 15000 },
    }

    const monthlyCredits = PLAN_CREDITS[plan].monthly
    const resetDate = new Date()
    resetDate.setMonth(resetDate.getMonth() + 1)
    resetDate.setDate(1)

    const { data: credits, error: insertError } = await supabase
      .from('user_credits')
      .insert({
        user_id: userData.user.id,
        balance: monthlyCredits + (plan === 'free' ? PLAN_CREDITS.free.signup_bonus : 0),
        plan,
        monthly_credits: monthlyCredits,
        reset_date: resetDate.toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    return Response.json({ data: credits }, { status: 201 })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to initialize credits' },
      { status: 500 }
    )
  }
}
