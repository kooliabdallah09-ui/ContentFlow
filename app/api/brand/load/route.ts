import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Loads the current user's brand profile.
// Schema mapping (no migration required — we reuse existing columns):
//   company_name        → Product name (UGC builder)
//   description         → One-line description (UGC builder)
//   unique_value_prop   → Key benefits (UGC builder)
//   brand_mission       → Default call to action (UGC builder)
//   target_audience     → Brand-only field (used by Claude as context)
//   tone_of_voice       → Brand-only field (used by Claude as context)

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.slice(7))
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('brand_profiles')
      .select('company_name, description, unique_value_prop, brand_mission, target_audience, tone_of_voice, logo_url')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (error) {
      console.error('brand_profiles load error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Returns null when the user has never saved a brand profile — UI shows
    // "no brand profile yet" empty state in that case.
    return NextResponse.json({ profile: data ?? null })
  } catch (err) {
    console.error('brand/load error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
