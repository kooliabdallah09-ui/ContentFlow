import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.slice(7)

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = userData.user.id

    // Column list intentionally excludes `name` — it was added late in dev and
    // still isn't present on every environment's schema. Selecting a non-
    // existent column throws PGRST204 and blows the whole endpoint. If you
    // need the name later, prefer to derive it from metadata.productName.
    const { data: items, error } = await supabase
      .from('ugc_content')
      .select('id, content_type, storage_url, metadata, credit_cost, status, created_at')
      .eq('user_id', userId)
      .eq('content_type', 'video')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[library] Supabase query error:', error)
      // Surface the real Postgres error code so the client toast can show it.
      return NextResponse.json({ error: `Failed to fetch library: ${error.message}`, code: error.code }, { status: 500 })
    }

    return NextResponse.json({ items: items ?? [] })
  } catch (err) {
    console.error('[library]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
