import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

// POST /api/intelligence/refresh
// Wipes the user's niche cache and re-runs generate-plan with fresh trend data.
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

    const { data: profile } = await supabase
      .from('user_intelligence')
      .select('niche, preferred_platforms')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (profile) {
      const platform = (profile.preferred_platforms?.[0] as string) || 'tiktok'
      await supabase.from('trend_cache').delete().eq('cache_key', `${profile.niche}:${platform}`)
    }

    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://contentflow-web.com'
    const res = await fetch(`${base}/api/intelligence/generate-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Refresh failed' },
      { status: 500 },
    )
  }
}
