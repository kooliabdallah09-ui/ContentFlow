import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { publishToYouTube, refreshYouTubeToken } from '@/lib/integrations/youtube'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
    if (!userData?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = userData.user.id

    const { videoUrl, title, description = '', privacyStatus = 'public' } = await req.json()

    if (!videoUrl || typeof videoUrl !== 'string') {
      return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 })
    }
    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    if (!['public', 'unlisted', 'private'].includes(privacyStatus)) {
      return NextResponse.json({ error: 'Invalid privacyStatus' }, { status: 400 })
    }

    const { data: integration } = await supabase
      .from('integrations')
      .select('access_token, refresh_token, is_connected')
      .eq('user_id', userId)
      .eq('platform', 'youtube')
      .single()

    if (!integration?.is_connected) {
      return NextResponse.json({ error: 'YouTube not connected' }, { status: 400 })
    }

    // Always refresh the token before uploading
    let accessToken = integration.access_token
    if (integration.refresh_token) {
      try {
        accessToken = await refreshYouTubeToken(integration.refresh_token)
        await supabase
          .from('integrations')
          .update({ access_token: accessToken })
          .eq('user_id', userId)
          .eq('platform', 'youtube')
      } catch {
        return NextResponse.json(
          { error: 'YouTube token expired — please reconnect in Settings → Integrations' },
          { status: 401 },
        )
      }
    }

    const result = await publishToYouTube({
      accessToken,
      videoUrl,
      title: title.trim().slice(0, 100),
      description: description.trim().slice(0, 5000),
      privacyStatus,
    })

    return NextResponse.json({ youtubeUrl: result.videoUrl, videoId: result.postId })
  } catch (err) {
    console.error('[youtube/publish]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Publish failed' },
      { status: 500 },
    )
  }
}
