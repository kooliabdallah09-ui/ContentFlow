import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { initializeTwitterPublisher } from '@/lib/integrations/twitter'
import { publishToInstagram, publishToFacebook } from '@/lib/integrations/instagram'

export async function POST(request: NextRequest) {
  try {
    const { contentId, platform } = await request.json()

    if (!contentId || !platform) {
      return NextResponse.json(
        { error: 'Missing contentId or platform' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set(name, value, options)
            } catch {
              // Silently fail
            }
          },
          remove(name: string) {
            try {
              cookieStore.delete(name)
            } catch {
              // Silently fail
            }
          },
        },
      }
    )

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get content
    const { data: content, error: contentError } = await supabase
      .from('content')
      .select('*')
      .eq('id', contentId)
      .eq('user_id', user.id)
      .single()

    if (contentError || !content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    // Get integration token
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', platform)
      .single()

    if (integrationError || !integration) {
      return NextResponse.json(
        { error: `${platform} integration not connected` },
        { status: 404 }
      )
    }

    let publishedId = null
    let result: any = null

    // Prepare content text/caption
    const contentCaption =
      content.content_type === 'social'
        ? content.body
        : `${content.title}\n\n${content.body.substring(0, 250)}...`

    // Get featured image if available
    const featuredImage = content.metadata?.featuredImage || null

    // Publish based on platform
    if (platform === 'twitter') {
      const publisher = initializeTwitterPublisher(
        integration.access_token,
        '',
        process.env.TWITTER_API_KEY!,
        process.env.TWITTER_API_SECRET!
      )

      publishedId = await publisher.publish({ content: contentCaption })
    } else if (platform === 'instagram') {
      result = await publishToInstagram({
        accessToken: integration.access_token,
        caption: contentCaption,
        imageUrl: featuredImage,
      })
      publishedId = result.postId

      if (!result.success) {
        return NextResponse.json(
          { error: `Failed to publish to Instagram: ${result.error}` },
          { status: 400 }
        )
      }
    } else if (platform === 'facebook') {
      result = await publishToFacebook({
        accessToken: integration.access_token,
        pageId: integration.account_id,
        caption: contentCaption,
        imageUrl: featuredImage,
      })
      publishedId = result.postId

      if (!result.success) {
        return NextResponse.json(
          { error: `Failed to publish to Facebook: ${result.error}` },
          { status: 400 }
        )
      }
    }

    // Update content status
    await supabase
      .from('content')
      .update({
        published: true,
        metadata: {
          ...content.metadata,
          published_on: [
            ...(Array.isArray(content.metadata?.published_on)
              ? content.metadata.published_on
              : []),
            {
              platform,
              publishedId,
              publishedAt: new Date().toISOString(),
            },
          ],
        },
      })
      .eq('id', contentId)

    return NextResponse.json({
      success: true,
      publishedId,
      platform,
    })
  } catch (error) {
    console.error('Publish error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Publishing failed' },
      { status: 500 }
    )
  }
}
