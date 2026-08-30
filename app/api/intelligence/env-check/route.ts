// Diagnostic: verify which intelligence-related env vars are actually present
// on this deploy. Admin-only. Returns booleans (never the values themselves).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
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

  return NextResponse.json({
    APIFY_TOKEN: !!process.env.APIFY_TOKEN,
    APIFY_TIKTOK_ACTOR_ID: process.env.APIFY_TIKTOK_ACTOR_ID || null,
    APIFY_INSTAGRAM_ACTOR_ID: process.env.APIFY_INSTAGRAM_ACTOR_ID || null,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    SERPAPI_KEY: !!process.env.SERPAPI_KEY,
  })
}
