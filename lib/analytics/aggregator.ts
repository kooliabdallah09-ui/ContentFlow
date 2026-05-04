import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function createSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
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
}

export interface ContentMetrics {
  contentId: string
  title: string
  contentType: string
  platform: string
  views: number
  clicks: number
  shares: number
  comments: number
  likes: number
  engagementRate: number
  fetchedAt: string
}

export interface AggregatedMetrics {
  totalPosts: number
  totalViews: number
  totalClicks: number
  totalShares: number
  averageEngagementRate: number
  topPost: ContentMetrics | null
  platformBreakdown: Record<string, any>
  timeRange: {
    from: string
    to: string
  }
}

export async function getContentMetrics(userId: string, days: number = 30) {
  const supabase = await createSupabaseClient()

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data, error } = await supabase
    .from('content_analytics')
    .select(
      `
      *,
      content:content_id(id, title, content_type)
    `
    )
    .eq('user_id', userId)
    .gte('fetched_at', startDate.toISOString())
    .order('fetched_at', { ascending: false })

  if (error) throw error

  return data || []
}

export async function aggregateMetrics(userId: string, days: number = 30): Promise<AggregatedMetrics> {
  const metrics = await getContentMetrics(userId, days)

  if (metrics.length === 0) {
    return {
      totalPosts: 0,
      totalViews: 0,
      totalClicks: 0,
      totalShares: 0,
      averageEngagementRate: 0,
      topPost: null,
      platformBreakdown: {},
      timeRange: {
        from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        to: new Date().toISOString(),
      },
    }
  }

  const platformBreakdown: Record<string, any> = {}
  let totalViews = 0
  let totalClicks = 0
  let totalShares = 0
  let totalEngagement = 0

  const metricsByContent: Record<string, any> = {}

  for (const metric of metrics) {
    totalViews += metric.views || 0
    totalClicks += metric.clicks || 0
    totalShares += metric.shares || 0
    totalEngagement += metric.engagement_rate || 0

    // Platform breakdown
    if (!platformBreakdown[metric.platform]) {
      platformBreakdown[metric.platform] = {
        posts: 0,
        views: 0,
        clicks: 0,
        shares: 0,
        avgEngagement: 0,
      }
    }

    platformBreakdown[metric.platform].posts += 1
    platformBreakdown[metric.platform].views += metric.views || 0
    platformBreakdown[metric.platform].clicks += metric.clicks || 0
    platformBreakdown[metric.platform].shares += metric.shares || 0
    platformBreakdown[metric.platform].avgEngagement += metric.engagement_rate || 0

    // Track metrics by content
    const contentId = metric.content_id
    if (!metricsByContent[contentId]) {
      metricsByContent[contentId] = {
        title: metric.content?.title || 'Unknown',
        views: 0,
        clicks: 0,
        shares: 0,
        engagementRate: 0,
      }
    }

    metricsByContent[contentId].views += metric.views || 0
    metricsByContent[contentId].clicks += metric.clicks || 0
    metricsByContent[contentId].shares += metric.shares || 0
  }

  // Find top post
  let topPost = null
  let maxEngagement = 0

  for (const metric of metrics) {
    if ((metric.engagement_rate || 0) > maxEngagement) {
      maxEngagement = metric.engagement_rate || 0
      topPost = metric
    }
  }

  return {
    totalPosts: Object.keys(metricsByContent).length,
    totalViews,
    totalClicks,
    totalShares,
    averageEngagementRate: metrics.length > 0 ? totalEngagement / metrics.length : 0,
    topPost: topPost as ContentMetrics | null,
    platformBreakdown,
    timeRange: {
      from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
      to: new Date().toISOString(),
    },
  }
}

export async function getContentPerformance(userId: string, days: number = 30) {
  const metrics = await getContentMetrics(userId, days)

  const performance: Record<string, any> = {}

  for (const metric of metrics) {
    const contentId = metric.content_id
    if (!performance[contentId]) {
      performance[contentId] = {
        title: metric.content?.title || 'Unknown',
        type: metric.content?.content_type || 'unknown',
        platforms: {},
      }
    }

    if (!performance[contentId].platforms[metric.platform]) {
      performance[contentId].platforms[metric.platform] = {
        views: 0,
        clicks: 0,
        shares: 0,
        comments: 0,
        likes: 0,
        engagementRate: 0,
      }
    }

    performance[contentId].platforms[metric.platform] = {
      views: metric.views || 0,
      clicks: metric.clicks || 0,
      shares: metric.shares || 0,
      comments: metric.comments || 0,
      likes: metric.likes || 0,
      engagementRate: metric.engagement_rate || 0,
    }
  }

  return performance
}
