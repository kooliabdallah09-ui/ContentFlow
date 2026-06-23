import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.slice(7))
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { contentId, videoUrl, status, error } = await request.json()
  if (!contentId) return NextResponse.json({ error: 'Missing contentId' }, { status: 400 })

  const newMeta = videoUrl
    ? { videoUrl, completedAt: new Date().toISOString() }
    : { error: error ?? 'unknown', failedAt: new Date().toISOString() }

  const { error: updateError } = await supabase
    .from('ugc_content')
    .update({
      status: status === 'completed' ? 'completed' : 'failed',
      storage_url: videoUrl
        ? JSON.stringify({ video: { videoUrl, status: 'completed' } })
        : undefined,
      metadata: newMeta,
    })
    .eq('id', contentId)
    .eq('user_id', userData.user.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
