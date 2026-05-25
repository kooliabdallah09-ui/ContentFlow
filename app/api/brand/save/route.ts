import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      user_id, user_email,
      company_name, description, target_audience, tone_of_voice,
      product_type, unique_value_prop, brand_mission, customer_pain_points,
      brand_colors, posting_frequency, logo_url,
    } = body

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

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
