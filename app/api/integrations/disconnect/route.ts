import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revokeToken } from '@/lib/integrations/tiktok'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.slice(7)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { platform } = await request.json()
    if (!platform) return NextResponse.json({ error: 'Missing platform' }, { status: 400 })

    // Revoke TikTok's token too, so the app really loses access.
    if (platform === 'tiktok') {
      const { data: row } = await supabase.from('integrations').select('access_token')
        .eq('user_id', userData.user.id).eq('platform', 'tiktok').maybeSingle()
      if (row?.access_token) await revokeToken(row.access_token)
    }

    const { error } = await supabase
      .from('integrations')
      .delete()
      .eq('user_id', userData.user.id)
      .eq('platform', platform)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Disconnect error:', error)
    return NextResponse.json({ error: 'Disconnection failed' }, { status: 500 })
  }
}
