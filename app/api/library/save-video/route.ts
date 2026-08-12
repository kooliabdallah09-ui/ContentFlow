import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.slice(7)

  try {
    const body = await request.json()
    const { videoUrl, source, title, creditCost, metadata } = body

    if (!videoUrl) {
      return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = userData.user.id

    const { data, error } = await supabase
      .from('ugc_content')
      .insert({
        user_id: userId,
        content_type: 'video',
        storage_url: videoUrl,
        status: 'completed',
        name: title ?? source ?? 'Video',
        credit_cost: creditCost ?? 0,
        metadata: {
          source: source ?? 'unknown',
          ...metadata,
        },
      })
      .select('id')
      .single()

    if (error) {
      console.error('[save-video]', error)
      return NextResponse.json({ error: 'Failed to save video' }, { status: 500 })
    }

    return NextResponse.json({ id: data.id })
  } catch (err) {
    console.error('[save-video]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
