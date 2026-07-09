import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
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

    const { data: profile } = await supabase
      .from('user_intelligence')
      .select('niche, product_type, audience_profile, goal')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    const { data: plan } = await supabase
      .from('content_plans')
      .select('*')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (!plan) {
      return NextResponse.json({ plan: null, profile, hasProfile: !!profile })
    }

    const needsRefresh = plan.refresh_date ? new Date(plan.refresh_date) < new Date() : true
    return NextResponse.json({ plan, profile, hasProfile: !!profile, needsRefresh })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Fetch failed' },
      { status: 500 },
    )
  }
}
