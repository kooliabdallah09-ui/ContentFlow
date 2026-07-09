import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { gatherTrends } from '@/lib/intelligence/trends'

export const maxDuration = 60

// Content Intelligence — Step 3: score UGC formats + generate hooks +
// build a 30-day calendar tailored to this specific user's niche.
export async function POST(request: NextRequest) {
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
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'Complete onboarding first' }, { status: 400 })
    }

    // Get trends: try cache first, else fetch inline.
    const platform = (profile.preferred_platforms?.[0] as string) || 'tiktok'
    const cacheKey = `${profile.niche}:${platform}`
    const { data: cached } = await supabase
      .from('trend_cache')
      .select('data, expires_at')
      .eq('cache_key', cacheKey)
      .maybeSingle()

    let trends
    if (cached && new Date(cached.expires_at) > new Date()) {
      trends = cached.data
    } else {
      trends = await gatherTrends({
        keywords: profile.trend_keywords ?? [],
        subreddits: profile.niche_subreddits ?? [],
      })
      await supabase
        .from('trend_cache')
        .upsert({
          cache_key: cacheKey,
          data: trends,
          expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          cached_at: new Date().toISOString(),
        }, { onConflict: 'cache_key' })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const prompt = `You are a content strategist specializing in UGC marketing for small brands and solo founders.

Given this user profile and real-time market data, do 3 things:

1. SCORE each UGC format from 0-100 for this specific niche.
   Available formats: grwm, before_after, hot_take, unboxing, review, tutorial, pov, storytime
   Base scoring on the trend data. If trend data is null/sparse, use your own knowledge of the niche.

2. GENERATE 5 hooks for each of the top 3 formats.
   Hooks must be first sentences that grab attention in 3 seconds.
   Pull inspiration from Reddit pain points and rising Google queries when available.

3. BUILD a 30-day calendar in 4 weekly themes:
   Week 1: Brand discovery
   Week 2: Education
   Week 3: Social proof
   Week 4: Conversion
   3-4 posts per week (12-16 total, NOT one per day).
   Each entry: format, hook, hashtags (3-5), best posting time (24h HH:MM), platform.

User profile:
${JSON.stringify(profile, null, 2)}

Market data (real-time snapshot):
${JSON.stringify(trends, null, 2)}

Respond ONLY with valid JSON, no preamble, no markdown:
{
  "niche_opportunity": "high" | "medium" | "low",
  "competition_level": "high" | "medium" | "low",
  "audience_pain_points": ["3-5 short pain points, one line each"],
  "top_formats": [
    { "format": "before_after", "score": 92, "why": "1-sentence explanation" }
  ],
  "hooks": {
    "before_after": ["hook 1", "hook 2", "hook 3", "hook 4", "hook 5"]
  },
  "calendar": [
    {
      "day": 1,
      "week": 1,
      "week_theme": "Brand discovery",
      "format": "unboxing",
      "hook": "the exact first sentence",
      "hashtags": ["#tag1","#tag2","#tag3"],
      "best_time": "19:00",
      "platform": "tiktok"
    }
  ],
  "trending_hashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5"]
}`

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim()
    const cleaned = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/, '')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let plan: any
    try { plan = JSON.parse(cleaned) } catch {
      return NextResponse.json({ error: 'Plan parse failed', raw: cleaned.slice(0, 500) }, { status: 500 })
    }

    const row = {
      user_id: userId,
      plan_data: {
        niche_opportunity: plan.niche_opportunity ?? 'medium',
        competition_level: plan.competition_level ?? 'medium',
        audience_pain_points: plan.audience_pain_points ?? [],
      },
      top_formats: plan.top_formats ?? [],
      hooks: plan.hooks ?? {},
      calendar_30d: plan.calendar ?? [],
      trend_snapshot: trends,
      trending_hashtags: plan.trending_hashtags ?? [],
      refresh_date: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('content_plans')
      .upsert(row, { onConflict: 'user_id' })
    if (error) throw error

    return NextResponse.json({ success: true, plan: row })
  } catch (err) {
    console.error('intelligence/generate-plan error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Plan generation failed' },
      { status: 500 },
    )
  }
}
