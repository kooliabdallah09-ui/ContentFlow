import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { initializeTwitterPublisher } from '@/lib/integrations/twitter'
import { publishToInstagram, publishToFacebook } from '@/lib/integrations/instagram'
import { publishToLinkedIn } from '@/lib/integrations/linkedin'
import { publishToYouTube, refreshYouTubeToken } from '@/lib/integrations/youtube'
import { publishToTikTok, refreshTikTokToken } from '@/lib/integrations/tiktok'
import { initializeWordPressPublisher } from '@/lib/integrations/wordpress'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { contentId, platform } = await request.json()

    if (!contentId || !platform) {
      return NextResponse.json({ error: 'Missing contentId or platform' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get: (name) => cookieStore.get(name)?.value,
          set: (name, value, options) => { try { cookieStore.set(name, value, options) } catch {} },
          remove: (name) => { try { cookieStore.delete(name) } catch {} },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Try content table first, then ugc_content
    let content: any = null
    const { data: textContent } = await supabase
      .from('content')
      .select('*')
      .eq('id', contentId)
      .eq('user_id', user.id)
      .single()

    if (textContent) {
      content = textContent
    } else {
      const { data: ugcContent } = await supabase
        .from('ugc_content')
        .select('*')
        .eq('id', contentId)
        .eq('user_id', user.id)
        .single()
      content = ugcContent
    }

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    // Get integration
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', platform)
      .single()

    if (integrationError || !integration) {
      return NextResponse.json({ error: `${platform} not connected` }, { status: 404 })
    }

    // Prepare text caption
    const body = content.body || content.metadata?.script || content.metadata?.text || ''
    const caption = content.content_type === 'social'
      ? body
      : body.length > 280
        ? body.substring(0, 277) + '...'
        : body

    const featuredImage: string | null = content.metadata?.featuredImage || null
    const videoUrl: string | null = content.metadata?.videoUrl || content.storage_url || null

    let publishedId: string | null = null
    let accessToken = integration.access_token

    // --- TWITTER ---
    if (platform === 'twitter') {
      const publisher = initializeTwitterPublisher(accessToken)
      publishedId = await publisher.publish({ content: caption })
    }

    // --- INSTAGRAM ---
    else if (platform === 'instagram') {
      if (!featuredImage && !videoUrl) {
        return NextResponse.json(
          { error: 'Instagram requires an image or video. Generate one first.' },
          { status: 400 }
        )
      }
      const result = await publishToInstagram({
        accessToken,
        caption,
        imageUrl: featuredImage || undefined,
        videoUrl: videoUrl || undefined,
      })
      if (!result.success) throw new Error(result.error)
      publishedId = result.postId
    }

    // --- FACEBOOK ---
    else if (platform === 'facebook') {
      const result = await publishToFacebook({
        accessToken,
        pageId: integration.account_id,
        caption,
        imageUrl: featuredImage || undefined,
        videoUrl: videoUrl || undefined,
      })
      if (!result.success) throw new Error(result.error)
      publishedId = result.postId
    }

    // --- LINKEDIN ---
    else if (platform === 'linkedin') {
      const result = await publishToLinkedIn({
        accessToken,
        authorId: integration.account_id,
        text: caption,
        imageUrl: featuredImage || undefined,
      })
      publishedId = result.postId
    }

    // --- YOUTUBE ---
    else if (platform === 'youtube') {
      if (!videoUrl) {
        return NextResponse.json(
          { error: 'YouTube requires a video. Generate one first.' },
          { status: 400 }
        )
      }
      // Refresh token if we have one
      if (integration.refresh_token) {
        try {
          accessToken = await refreshYouTubeToken(integration.refresh_token)
          await supabase.from('integrations')
            .update({ access_token: accessToken })
            .eq('id', integration.id)
        } catch {}
      }
      const result = await publishToYouTube({
        accessToken,
        videoUrl,
        title: content.title || 'New Video',
        description: body,
      })
      publishedId = result.postId
    }

    // --- TIKTOK ---
    else if (platform === 'tiktok') {
      if (!videoUrl) {
        return NextResponse.json(
          { error: 'TikTok requires a video. Generate one first.' },
          { status: 400 }
        )
      }
      if (integration.refresh_token) {
        try {
          accessToken = await refreshTikTokToken(integration.refresh_token)
          await supabase.from('integrations')
            .update({ access_token: accessToken })
            .eq('id', integration.id)
        } catch {}
      }
      const result = await publishToTikTok({
        accessToken,
        videoUrl,
        title: caption,
      })
      publishedId = result.postId
    }

    // --- WORDPRESS ---
    else if (platform === 'wordpress') {
      const publisher = initializeWordPressPublisher(
        integration.metadata?.siteUrl,
        integration.account_id,
        integration.access_token
      )
      publishedId = await publisher.publish({
        title: content.title,
        content: body,
        excerpt: content.meta_description,
        featuredImageUrl: featuredImage,
      })
    }

    else {
      return NextResponse.json({ error: `Unsupported platform: ${platform}` }, { status: 400 })
    }

    // Mark content as published
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const table = textContent ? 'content' : 'ugc_content'
    await adminSupabase
      .from(table)
      .update({
        published: true,
        metadata: {
          ...content.metadata,
          published_on: [
            ...(Array.isArray(content.metadata?.published_on) ? content.metadata.published_on : []),
            { platform, publishedId, publishedAt: new Date().toISOString() },
          ],
        },
      })
      .eq('id', contentId)

    return NextResponse.json({ success: true, publishedId, platform })
  } catch (error) {
    console.error('Publish error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Publishing failed' },
      { status: 500 }
    )
  }
}
