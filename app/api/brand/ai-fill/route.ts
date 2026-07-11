// Given a one-sentence product description, expand it into every brand-form
// field so the user doesn't have to type each box. Powers the "AI Fill"
// action at the top of the onboarding brand step.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

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

    const body = await request.json()
    const seed = String(body?.description ?? '').slice(0, 800).trim()
    if (seed.length < 5) {
      return NextResponse.json({ error: 'Add a longer description' }, { status: 400 })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      messages: [{
        role: 'user',
        content: `Expand this one-line product description into a complete brand profile. Fill EVERY field with a concrete, opinionated answer — no vague marketing speak.

Description: "${seed}"

Return ONLY valid JSON (no markdown, no preamble):
{
  "companyName": "concise brand name (invent one if the description doesn't name it)",
  "description": "2-3 sentences describing what the product is and who it's for",
  "productType": "one of: physical product, digital product, service, SaaS, app, course, coaching",
  "uniqueValue": "one sentence — what makes this different from competitors",
  "brandMission": "one sentence mission — what the brand is trying to change",
  "targetAudience": "one sentence — demographic + psychographic (e.g. 'women 25-40 who care about clean ingredients')",
  "customerPainPoints": "3-4 specific pain points, comma-separated",
  "toneOfVoice": "one of: playful, authoritative, warm, edgy, minimal, luxurious, professional, conversational",
  "brandColors": "2-3 hex codes comma-separated (e.g. '#0F172A, #F97316') — leave empty if you can't infer"
}`,
      }],
    })
    const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim()
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '')
    let profile: Record<string, string>
    try { profile = JSON.parse(cleaned) } catch {
      return NextResponse.json({ error: 'Could not parse — try again' }, { status: 500 })
    }
    return NextResponse.json({ profile })
  } catch (err) {
    console.error('brand/ai-fill error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    )
  }
}
