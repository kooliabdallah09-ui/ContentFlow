// Vercel cron endpoint — runs every hour
// Finds all queued YouTube jobs that are due and publishes them.
// Called by Vercel's cron scheduler; protected by CRON_SECRET env var.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { publishToYouTube, refreshYouTubeToken } from '@/lib/integrations/youtube'

export const maxDuration = 300

export async function GET(req: NextRequest) {
  // Verify this is called by Vercel's cron scheduler
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Find all jobs that are due (scheduled_at <= now, still queued)
  const now = new Date().toISOString()
  const { data: jobs, error: fetchError } = await supabase
    .from('youtube_publish_queue')
    .select('*')
    .eq('status', 'queued')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(20) // process at most 20 per cron tick to stay within timeout

  if (fetchError) {
    console.error('[auto-publish] fetch error:', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ processed: 0, message: 'No jobs due' })
  }

  const results: { id: string; status: string; yt_video_url?: string; error?: string }[] = []

  for (const job of jobs) {
    // Mark as uploading so a concurrent cron tick doesn't double-process it
    await supabase
      .from('youtube_publish_queue')
      .update({ status: 'uploading' })
      .eq('id', job.id)
      .eq('status', 'queued') // double-check — another tick may have already claimed it

    try {
      // Get user's YouTube integration
      const { data: integration } = await supabase
        .from('integrations')
        .select('access_token, refresh_token, is_connected')
        .eq('user_id', job.user_id)
        .eq('platform', 'youtube')
        .single()

      if (!integration?.is_connected) {
        throw new Error('YouTube not connected')
      }

      // Always refresh the token before uploading
      let accessToken = integration.access_token
      if (integration.refresh_token) {
        accessToken = await refreshYouTubeToken(integration.refresh_token)
        await supabase
          .from('integrations')
          .update({ access_token: accessToken })
          .eq('user_id', job.user_id)
          .eq('platform', 'youtube')
      }

      const result = await publishToYouTube({
        accessToken,
        videoUrl: job.video_url,
        title: job.title,
        description: job.description,
        tags: job.tags ?? [],
        privacyStatus: job.privacy,
      })

      // Mark published
      await supabase
        .from('youtube_publish_queue')
        .update({
          status: 'published',
          yt_video_id: result.postId,
          yt_video_url: result.videoUrl,
          error_message: null,
        })
        .eq('id', job.id)

      results.push({ id: job.id, status: 'published', yt_video_url: result.videoUrl })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[auto-publish] job ${job.id} failed:`, msg)

      await supabase
        .from('youtube_publish_queue')
        .update({ status: 'failed', error_message: msg })
        .eq('id', job.id)

      results.push({ id: job.id, status: 'failed', error: msg })
    }
  }

  console.log(`[auto-publish] processed ${results.length} jobs`)
  return NextResponse.json({ processed: results.length, results })
}
