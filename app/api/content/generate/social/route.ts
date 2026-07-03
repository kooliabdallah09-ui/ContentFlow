import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/deduct-credits'
import { loadBrandContext, formatBrandPrompt } from '@/lib/brand-context'

const CREDIT_COST = 5

const PLATFORM_GUIDES: Record<string, string> = {
  instagram: 'Instagram caption (max 2200 chars). Hook in line 1, short punchy paragraphs, end with 5–10 relevant hashtags on a new line.',
  linkedin:  'LinkedIn post (max 3000 chars). Lead with an insight or story, expand with 3–5 short paragraphs, end with a question or CTA. 3–5 hashtags inline.',
  twitter:   'X/Twitter post (max 280 chars). One sharp, quotable sentence. No hashtags unless they fit naturally within the limit.',
  tiktok:    'TikTok video caption (max 300 chars). Casual, energetic, FOMO-driven. 3–5 trending hashtags on the same line.',
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = userData.user.id

  const { topic, platforms, tone = 'bold' } = await request.json()

  if (!topic?.trim()) {
    return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
  }
  if (!Array.isArray(platforms) || platforms.length === 0) {
    return NextResponse.json({ error: 'Select at least one platform' }, { status: 400 })
  }

  const validPlatforms = platforms.filter((p: string) => PLATFORM_GUIDES[p])
  if (validPlatforms.length === 0) {
    return NextResponse.json({ error: 'No valid platforms selected' }, { status: 400 })
  }

  let balance = 0
  let packCredits = 0
  {
    const withPack = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .maybeSingle()
    if (withPack.data) {
      balance = withPack.data.balance ?? 0
      packCredits = withPack.data.pack_credits ?? 0
    } else {
      const fallback = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle()
      balance = fallback.data?.balance ?? 0
    }
  }

  if (balance < CREDIT_COST) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
  }

  await deductCredits(supabase, userId, CREDIT_COST, balance, packCredits)

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const toneGuide =
    tone === 'bold'          ? 'Bold and punchy — short sentences, strong verbs, no filler.' :
    tone === 'conversational'? 'Conversational and friendly — reads like a friend sharing a hot tip.' :
    tone === 'professional'  ? 'Professional and credible — authoritative but never stiff.' :
    tone === 'storytelling'  ? 'Story-driven — open with a hook moment, build tension, land the message.' :
                               'Engaging and clear.'

  const platformBlocks = validPlatforms
    .map((p: string) => `${p.toUpperCase()}: ${PLATFORM_GUIDES[p]}`)
    .join('\n\n')

  const brandCtx = await loadBrandContext(supabase, userId)
  const brandBlock = formatBrandPrompt(brandCtx)

  const prompt = `You are an expert social media copywriter. Generate platform-native posts for the topic below.
${brandBlock}
TOPIC: ${topic.trim()}
TONE: ${toneGuide}

For each platform, write exactly the post content (caption + hashtags if applicable). Do NOT add platform labels inside the content — return only the post body.

${platformBlocks}

Return ONLY valid JSON (no markdown fences):
{
  ${validPlatforms.map((p: string) => `"${p}": "full post content here"`).join(',\n  ')}
}`

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawText = (msg.content[0] as { type: 'text'; text: string }).text.trim()
  let posts: Record<string, string>
  try {
    let jsonText = rawText
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    }
    posts = JSON.parse(jsonText)
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }

  return NextResponse.json({ posts, creditsUsed: CREDIT_COST })
}
