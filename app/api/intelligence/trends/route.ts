import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { gatherTrends } from '@/lib/intelligence/trends'

export const maxDuration = 30

// GET /api/intelligence/trends
// Returns a niche-scoped trend snapshot for the authenticated user.
// Cached for 24h in trend_cache; fresh calls fan out to TikTok/Google/Reddit
// with soft failure per source.
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = userData.user.id

    const { data: profile } = await supabase
      .from('user_intelligence')
      .select('niche, trend_keywords, niche_subreddits, preferred_platforms')
      .eq('user_id', userId)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'Complete onboarding first' }, { status: 400 })
    }

    const platform = (profile.preferred_platforms?.[0] as string) || 'tiktok'
    const cacheKey = `${profile.niche}:${platform}`

    // Check cache
    const { data: cached } = await supabase
      .from('trend_cache')
      .select('data, expires_at')
      .eq('cache_key', cacheKey)
      .maybeSingle()

    if (cached && new Date(cached.expires_at) > new Date()) {
      return NextResponse.json({ trends: cached.data, cached: true })
    }

    const trends = await gatherTrends({
      keywords: profile.trend_keywords ?? [],
      subreddits: profile.niche_subreddits ?? [],
    })

    // Store in cache — 24h TTL
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    await supabase
      .from('trend_cache')
      .upsert({ cache_key: cacheKey, data: trends, expires_at: expiresAt, cached_at: new Date().toISOString() }, { onConflict: 'cache_key' })

    return NextResponse.json({ trends, cached: false })
  } catch (err) {
    console.error('intelligence/trends error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Trends failed' },
      { status: 500 },
    )
  }
}
