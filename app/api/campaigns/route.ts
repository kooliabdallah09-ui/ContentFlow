import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/campaigns — list campaigns for the authed user (newest first).
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

  const { data, error } = await supabase
    .from('user_campaigns')
    .select('id, name, brief, product_id, goal, duration_label, status, meta, created_at')
    .eq('user_id', userData.user.id)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach shot counts.
  const ids = (data ?? []).map(c => c.id)
  const counts: Record<string, number> = {}
  if (ids.length) {
    const { data: shotRows } = await supabase
      .from('user_campaign_shots')
      .select('campaign_id')
      .in('campaign_id', ids)
    for (const r of shotRows ?? []) counts[r.campaign_id] = (counts[r.campaign_id] ?? 0) + 1
  }
  return NextResponse.json({ campaigns: (data ?? []).map(c => ({ ...c, shot_count: counts[c.id] ?? 0 })) })
}
