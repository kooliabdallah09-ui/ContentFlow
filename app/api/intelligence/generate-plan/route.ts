import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { gatherTrends } from '@/lib/intelligence/trends'

export const maxDuration = 300

// Sonnet occasionally truncates mid-calendar when max_tokens caps out.
// Salvage the largest prefix that still parses: cut at the last complete
// `}` inside the calendar array, then close the array + outer object.
// Returns null if we can't recover any complete calendar entry.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function salvageTruncatedPlan(raw: string): any | null {
  const calStart = raw.indexOf('"calendar"')
  if (calStart < 0) return null
  const arrOpen = raw.indexOf('[', calStart)
  if (arrOpen < 0) return null
  // Walk the string tracking brace depth so we can find the last
  // complete `}` at depth 1 (i.e. a completed calendar entry).
  let depth = 0
  let inStr = false
  let esc = false
  let lastCompleteEntryEnd = -1
  for (let i = arrOpen + 1; i < raw.length; i++) {
    const ch = raw[i]
    if (esc) { esc = false; continue }
    if (ch === '\\') { esc = true; continue }
    if (ch === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) lastCompleteEntryEnd = i
    }
  }
  if (lastCompleteEntryEnd < 0) return null
  const patched = raw.slice(0, lastCompleteEntryEnd + 1) + ']}'
  try { return JSON.parse(patched) } catch { return null }
}

// Content Intelligence — Step 3: score UGC formats + generate hooks +
// build a 30-day calendar tailored to this specific user's niche.
export async function POST(request: NextRequest) {
  console.log('[gen-plan] START')
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('[gen-plan] no auth header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[gen-plan] ANTHROPIC_API_KEY missing in runtime env')
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 500 })
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
    if (!userData.user) {
      console.log('[gen-plan] auth.getUser returned no user')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = userData.user.id
    console.log('[gen-plan] userId', userId)

    const { data: profile, error: profileErr } = await supabase
      .from('user_intelligence')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (profileErr) console.error('[gen-plan] profile fetch error', profileErr)

    if (!profile) {
      console.log('[gen-plan] no profile — user needs to complete onboarding')
      return NextResponse.json({ error: 'Complete onboarding first' }, { status: 400 })
    }
    console.log('[gen-plan] profile loaded, niche=', profile.niche)

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
      console.log('[gen-plan] using cached trends')
    } else {
      console.log('[gen-plan] fetching fresh trends')
      try {
        trends = await gatherTrends({
          keywords: profile.trend_keywords ?? [],
          subreddits: profile.niche_subreddits ?? [],
        })
        console.log('[gen-plan] gatherTrends done')
        await supabase
          .from('trend_cache')
          .upsert({
            cache_key: cacheKey,
            data: trends,
            expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            cached_at: new Date().toISOString(),
          }, { onConflict: 'cache_key' })
      } catch (trendErr) {
        console.error('[gen-plan] gatherTrends failed, using empty trends:', trendErr)
        trends = { tiktok: null, google: null, reddit: null, gatheredAt: new Date().toISOString() }
      }
    }

    // Pass only the profile fields Sonnet needs, not the whole row.
    const leanProfile = {
      niche: profile.niche,
      product_type: profile.product_type,
      product_description: profile.product_description,
      goal: profile.goal,
      audience_profile: profile.audience_profile,
      preferred_platforms: profile.preferred_platforms,
      trend_keywords: profile.trend_keywords,
      posting_frequency: profile.posting_frequency,
      format_preferences: profile.format_preferences,
    }

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
${JSON.stringify(leanProfile, null, 2)}

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
      "hook": "the exact first spoken sentence",
      "main_idea": "the concrete video concept — director's brief, one sentence, specific scene + action + payoff",
      "hashtags": ["#tag1","#tag2","#tag3"],
      "best_time": "19:00",
      "platform": "tiktok"
    }
  ],
  "trending_hashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5"]
}`

    console.log('[gen-plan] calling Sonnet, prompt chars=', prompt.length)
    const t0 = Date.now()
    let msg
    try {
      msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        // 30-day calendar with hook + main_idea + hashtags per entry +
        // top_formats + hooks-per-format regularly blows past 3k tokens.
        // 6000 gives Sonnet room to actually close the JSON.
        max_tokens: 6000,
        messages: [{ role: 'user', content: prompt }],
      })
    } catch (anthropicErr) {
      console.error('[gen-plan] Anthropic call threw:', anthropicErr instanceof Error ? anthropicErr.message : anthropicErr)
      return NextResponse.json({ error: `Anthropic call failed: ${anthropicErr instanceof Error ? anthropicErr.message : 'unknown'}` }, { status: 500 })
    }
    console.log('[gen-plan] Sonnet returned in', Date.now() - t0, 'ms, stop_reason=', msg.stop_reason)
    const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim()
    const cleaned = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/, '')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let plan: any
    try {
      plan = JSON.parse(cleaned)
    } catch {
      // Sonnet ran out of tokens mid-JSON. Try to salvage by closing the
      // JSON at the last complete `}` inside the calendar array, then
      // closing the outer array + object. Better than tanking the whole
      // onboarding for a truncated tail.
      console.warn('[gen-plan] JSON parse failed, attempting salvage. Length=', cleaned.length, 'stop_reason=', msg.stop_reason)
      plan = salvageTruncatedPlan(cleaned)
      if (!plan) {
        console.error('[gen-plan] salvage failed. Raw start:', cleaned.slice(0, 300))
        return NextResponse.json({ error: 'Plan parse failed', raw: cleaned.slice(0, 500) }, { status: 500 })
      }
      console.log('[gen-plan] salvage succeeded, calendar entries=', Array.isArray(plan.calendar) ? plan.calendar.length : 0)
    }
    console.log('[gen-plan] parsed plan, calendar entries=', Array.isArray(plan.calendar) ? plan.calendar.length : 'not-array')

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

    console.log('[gen-plan] upserting content_plans row')
    const { error } = await supabase
      .from('content_plans')
      .upsert(row, { onConflict: 'user_id' })
    if (error) {
      console.error('[gen-plan] content_plans upsert failed:', error)
      throw error
    }
    console.log('[gen-plan] DONE ok')

    return NextResponse.json({ success: true, plan: row })
  } catch (err) {
    console.error('[gen-plan] outer catch:', err instanceof Error ? err.stack || err.message : err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Plan generation failed' },
      { status: 500 },
    )
  }
}
