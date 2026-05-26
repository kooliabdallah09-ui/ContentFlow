import { getDuePublishes, updatePublishStatus } from '@/lib/scheduler'
import { initializeTwitterPublisher } from '@/lib/integrations/twitter'
import { createServerClient } from '@supabase/ssr'

async function publishToTwitter(
  accessToken: string,
  content: string
): Promise<string> {
  const publisher = initializeTwitterPublisher(accessToken)

  const tweetId = await publisher.publish({ content })
  return tweetId
}

export async function executeScheduledPublishes() {
  try {
    console.log('[Scheduler] Checking for due publishes...')

    const duePublishes = await getDuePublishes()

    if (!duePublishes || duePublishes.length === 0) {
      console.log('[Scheduler] No due publishes found')
      return { processed: 0, succeeded: 0, failed: 0 }
    }

    console.log(`[Scheduler] Found ${duePublishes.length} due publishes`)

    let succeeded = 0
    let failed = 0

    for (const item of duePublishes) {
      try {
        await updatePublishStatus(item.id, 'publishing')

        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          {
            cookies: {
              get(name: string) {
                return null
              },
              set(name: string, value: string, options: any) {
                // No-op for background job
              },
              remove(name: string) {
                // No-op for background job
              },
            },
          }
        )

        for (const platform of item.platforms) {
          if (platform === 'twitter') {
            // Get integration token
            const { data: integration, error: integrationError } = await supabase
              .from('integrations')
              .select('*')
              .eq('user_id', item.user_id)
              .eq('platform', 'twitter')
              .single()

            if (integrationError || !integration) {
              throw new Error(`${platform} integration not found`)
            }

            // Prepare content
            const tweetContent =
              item.content.content_type === 'social'
                ? item.content.body
                : `${item.content.title}\n\n${item.content.body.substring(0, 250)}...`

            // Publish
            const publishedId = await publishToTwitter(
              integration.access_token,
              tweetContent
            )

            // Update content metadata
            await supabase
              .from('content')
              .update({
                published: true,
                metadata: {
                  ...item.content.metadata,
                  published_on: [
                    ...(Array.isArray(item.content.metadata?.published_on)
                      ? item.content.metadata.published_on
                      : []),
                    {
                      platform,
                      publishedId,
                      publishedAt: new Date().toISOString(),
                    },
                  ],
                },
              })
              .eq('id', item.content_id)

            console.log(`[Scheduler] Published to ${platform}: ${publishedId}`)
          }
        }

        await updatePublishStatus(item.id, 'published')
        succeeded++
      } catch (error) {
        console.error(`[Scheduler] Failed to publish: ${error}`)
        await updatePublishStatus(
          item.id,
          'failed',
          error instanceof Error ? error.message : 'Unknown error'
        )
        failed++
      }
    }

    console.log(
      `[Scheduler] Completed: ${succeeded} succeeded, ${failed} failed`
    )

    return {
      processed: duePublishes.length,
      succeeded,
      failed,
    }
  } catch (error) {
    console.error('[Scheduler] Fatal error:', error)
    throw error
  }
}
