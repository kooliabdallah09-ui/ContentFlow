import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { gatherTrends } from '@/lib/intelligence/trends'

export const maxDuration = 300

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

    const topVideos = Array.isArray(profile.top_video_analyses) ? profile.top_video_analyses : []
    const analyzedVideos = topVideos
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((v: any) => v?.gemini)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((v: any) => ({
        platform: v.platform,
        sourceUrl: v.sourceUrl,
        views: v.views,
        likes: v.likes,
        authorHandle: v.authorHandle,
        hook: v.gemini.hook,
        format: v.gemini.format,
        pacing: v.gemini.pacing,
        hookVisual: v.gemini.hookVisual,
        cta: v.gemini.cta,
        captionStyle: v.gemini.captionStyle,
        keyMoments: v.gemini.keyMoments,
      }))

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const prompt = `You are a UGC expert who has produced thousands of short-form ads that hit for small brands and solo founders on TikTok, Reels, and Shorts. You know that formulaic influencer language dies on the feed and that the best-performing UGC ads land ONE specific idea per video — a real moment, a concrete before/after, a genuine reaction, a niche pain point that the target audience feels in their bones.

Given the user's profile, live market data, and analysis of top-performing short-form videos in this niche, do 3 things:

1. SCORE each UGC format from 0-100 for THIS specific niche.
   Available formats: grwm, before_after, hot_take, unboxing, review, tutorial, pov, storytime
   Base scoring on the trend data + your own expertise. If trend data is null/sparse, use your knowledge of what already works.

2. GENERATE 5 hooks for each of the top 3 formats.
   Hooks are the first sentence of the video — spoken by a real-person creator, casual and specific. NO 'game changer', NO 'you need this', NO 'obsessed'. Pull specific numbers, real objections, honest reactions, or curiosity gaps from Reddit pain points and rising Google queries when available.

3. BUILD a 30-day calendar in 4 weekly themes:
   Week 1: Brand discovery · Week 2: Education · Week 3: Social proof · Week 4: Conversion
   3-4 posts per week (12-16 total, NOT one per day — give the creator recovery days).

**Every calendar entry MUST include a clear "main_idea" — one sentence describing the concrete video concept the creator would film, NOT just the hook.** The main_idea explains: what the creator SHOWS on camera, what the payoff is, and why THIS video (not a generic ad) makes sense for that specific day in the arc. Think like a director briefing a creator. Examples of GOOD main_ideas:
- "Creator opens the product on their bathroom counter, uses it once, then shows the before/after in the mirror 10 minutes later — visual proof, no claims."
- "Creator sits in their car parked at Target and vents about the 5 skincare products they returned last month, then shows this one as the finally-worked answer."
- "Split-screen: creator's messy morning routine on the left, same routine with this product on the right — 3 seconds each side."
Avoid vague main_ideas like "share how the product helped them" or "highlight the benefits" — those are useless. Be specific about the scene, the action, and the beat.

For each entry also provide: format, hook (verbatim first spoken line), hashtags (3-5), best posting time (24h HH:MM), platform.

User profile:
${JSON.stringify(profile, null, 2)}

Market data (real-time snapshot):
${JSON.stringify(trends, null, 2)}

Top-performing videos in this niche (frame-by-frame analysis).
When choosing formats and drafting hooks, borrow rhythm and specificity from
these — they already have traction. If a hook here maps to the user's product,
echo its cadence:
${analyzedVideos.length ? JSON.stringify(analyzedVideos, null, 2) : '(no top-video data available — infer from the niche itself)'}

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
      "hook": "the exact first spoken sentence",
      "main_idea": "the concrete video concept — director's brief, one sentence, specific scene + action + payoff",
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
