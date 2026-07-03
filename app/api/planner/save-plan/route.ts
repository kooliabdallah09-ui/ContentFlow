import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user_id = userData.user.id

    const body = await req.json()
    const { month, year, plan_data } = body

    if (!month || !year || !plan_data) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Delete existing plan for this month/year, then insert fresh
    await supabaseAdmin
      .from('user_monthly_plans')
      .delete()
      .eq('user_id', user_id)
      .eq('month', month)
      .eq('year', year)

    const { error } = await supabaseAdmin
      .from('user_monthly_plans')
      .insert({ user_id, month, year, plan_data, status: 'active' })

    if (error) {
      console.error('user_monthly_plans insert error:', error.message, error.code)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('save-plan API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
