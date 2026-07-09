import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

// Content Intelligence — Step 1: turn 3 plain-English answers into a
// structured profile Claude can plan against.
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

    const body = await request.json()
    const answers = body?.answers ?? {}
    const product = String(answers.product ?? '').slice(0, 1000).trim()
    const audience = String(answers.audience ?? '').slice(0, 1000).trim()
    const goal = String(answers.goal ?? '').slice(0, 200).trim()

    if (!product || !audience || !goal) {
      return NextResponse.json({ error: 'Missing answers' }, { status: 400 })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const prompt = `Extract a structured content-marketing profile from these three answers.

Product / what you sell:
${product}

Target audience:
${audience}

Primary goal: ${goal}

Return ONLY valid JSON (no markdown, no preamble) with this exact shape:
{
  "niche": "short_snake_case_identifier (e.g. natural_skincare, saas_productivity, fitness_coaching)",
  "product_type": "physical_product" | "digital_product" | "service" | "saas",
  "audience_profile": {
    "age_range": "e.g. 25-40",
    "gender": "male" | "female" | "all",
    "psychographic": "1 sentence description",
    "intent": "purchase" | "subscribe" | "learn" | "engage",
    "platforms": ["tiktok","instagram"]
  },
  "trend_keywords": ["3-6 short keywords for Google Trends"],
  "niche_subreddits": ["r/SubredditName", "3-5 relevant subs, no r/ prefix inside quotes"],
  "preferred_platforms": ["tiktok","instagram"]
}`

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim()
    const cleaned = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/, '')
    let profile: Record<string, unknown>
    try { profile = JSON.parse(cleaned) } catch {
      return NextResponse.json({ error: 'Profile parse failed' }, { status: 500 })
    }

    const row = {
      user_id: userId,
      niche: String(profile.niche ?? 'general').slice(0, 60),
      product_description: product,
      product_type: String(profile.product_type ?? 'physical_product').slice(0, 40),
      audience_profile: profile.audience_profile ?? {},
      goal,
      trend_keywords: Array.isArray(profile.trend_keywords)
        ? (profile.trend_keywords as unknown[]).map(String).slice(0, 10)
        : [],
      niche_subreddits: Array.isArray(profile.niche_subreddits)
        ? (profile.niche_subreddits as unknown[]).map(String).slice(0, 8)
        : [],
      preferred_platforms: Array.isArray(profile.preferred_platforms)
        ? (profile.preferred_platforms as unknown[]).map(String).slice(0, 6)
        : ['tiktok', 'instagram'],
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('user_intelligence')
      .upsert(row, { onConflict: 'user_id' })
    if (error) throw error

    return NextResponse.json({ success: true, profile: row })
  } catch (err) {
    console.error('intelligence/onboard error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Onboard failed' },
      { status: 500 },
    )
  }
}
