import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ connected: false })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
    if (!userData?.user?.id) return NextResponse.json({ connected: false })

    const { data: integration } = await supabase
      .from('integrations')
      .select('account_name, is_connected')
      .eq('user_id', userData.user.id)
      .eq('platform', 'youtube')
      .single()

    if (!integration?.is_connected) return NextResponse.json({ connected: false })

    return NextResponse.json({ connected: true, accountName: integration.account_name })
  } catch {
    return NextResponse.json({ connected: false })
  }
}
