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
    const user_email = userData.user.email

    const body = await req.json()
    const {
      company_name, description, target_audience, tone_of_voice,
      product_type, unique_value_prop, brand_mission, customer_pain_points,
      brand_colors, posting_frequency, logo_url,
    } = body

    // Ensure profiles row exists (needed if brand_profiles.user_id FK still points to profiles.id)
    const { error: pe } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: user_id, email: user_email || null }, { onConflict: 'id' })
    if (pe) {
      // Retry without email in case of unique email conflict on another row
      await supabaseAdmin.from('profiles').upsert({ id: user_id }, { onConflict: 'id' })
    }

    // Upsert brand profile — requires migrations/000_fix_all_now.sql to have been run
    const { error } = await supabaseAdmin
      .from('brand_profiles')
      .upsert({
        user_id,
        company_name,
        description,
        target_audience,
        tone_of_voice,
        product_type,
        unique_value_prop,
        brand_mission,
        customer_pain_points,
        brand_colors,
        posting_frequency,
        logo_url,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (error) {
      console.error('brand_profiles upsert error:', error.message, 'code:', error.code)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
