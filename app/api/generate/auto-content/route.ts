import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { deductCredits } from '@/lib/deduct-credits'

const MODEL = 'claude-haiku-4-5-20251001'
const CREDIT_COST = 2

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { contentType, date, title, description, platforms } = body

    if (!contentType || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: brandProfile } = await supabase
      .from('brand_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!brandProfile) {
      return NextResponse.json(
        { error: 'Brand profile not set up. Please configure your brand in Settings first.' },
        { status: 400 }
      )
    }

    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', user.id)
      .maybeSingle()
    const balance = credits?.balance ?? 0
    const packCredits = credits?.pack_credits ?? 0
    if (balance < CREDIT_COST) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
    }

    const client = new Anthropic()
    const platformList = (platforms ?? []).join(', ') || 'Instagram, TikTok'
    const brandCtx = `Brand: ${brandProfile.company_name}
Description: ${brandProfile.description || ''}
Target Audience: ${brandProfile.target_audience || 'General'}
Tone: ${brandProfile.tone_of_voice || 'Professional'}
Unique Value: ${brandProfile.unique_value_prop || ''}`

    let prompt = ''

    if (contentType === 'video' || contentType === 'ugc' || contentType === 'reel' || contentType === 'short') {
      prompt = `${brandCtx}

Write a 30–60 second video script for an AI avatar for ${brandProfile.company_name}.
Topic: ${title}${description ? ` — ${description}` : ''}
Platforms: ${platformList}

Rules:
- Open with a hook (first 5 words must stop the scroll)
- Present the key message clearly
- End with a strong CTA
- Write ONLY the spoken words — no stage directions, no scene labels
- Under 150 words`

    } else if (contentType === 'voice') {
      prompt = `${brandCtx}

Write a 30–45 second audio script (spoken word only) for ${brandProfile.company_name}.
Topic: ${title}${description ? ` — ${description}` : ''}

Rules:
- Conversational, warm tone
- No references to visuals ("look at this", "as you can see")
- Strong opening, clear value, brief CTA
- Under 100 words`

    } else if (contentType === 'image') {
      prompt = `${brandCtx}

Write a detailed image generation prompt for an AI image generator (Flux Pro) for ${brandProfile.company_name}.
Content angle: ${title}${description ? ` — ${description}` : ''}

Rules:
- Describe a realistic lifestyle or conceptual scene (no app UI, no screenshots)
- Include: subject, setting, lighting, mood, color palette
- 2–3 sentences, highly specific and visual
- No text overlays or logos
- Return ONLY the image prompt`

    } else if (contentType === 'social') {
      prompt = `${brandCtx}

Write a social media post for ${brandProfile.company_name}.
Topic: ${title}${description ? ` — ${description}` : ''}
Platforms: ${platformList}

Rules:
- Engaging and conversational
- Include relevant emojis
- Strong CTA at the end
- Return ONLY the post text`

    } else if (contentType === 'blog') {
      prompt = `${brandCtx}

Write a structured blog post outline for ${brandProfile.company_name}.
Topic: ${title}${description ? ` — ${description}` : ''}

Include:
1. Title
2. Hook / intro paragraph (3 sentences)
3. 3–4 section headers with 2–3 bullet points each
4. Conclusion + CTA
5. 3 SEO keywords to weave in

Return as a clean outline.`

    } else if (contentType === 'email') {
      prompt = `${brandCtx}

Write a marketing email for ${brandProfile.company_name}.
Topic: ${title}${description ? ` — ${description}` : ''}

Format exactly as:
Subject: [subject line]
Preview: [preheader, max 100 chars]

[Email body — 150–250 words, clear value, one CTA at the end]`

    } else {
      return NextResponse.json({ error: `Unsupported content type: ${contentType}` }, { status: 400 })
    }

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')

    await deductCredits(supabase, user.id, CREDIT_COST, balance, packCredits)

    return NextResponse.json({
      success: true,
      content: content.text,
      creditsUsed: CREDIT_COST,
      metadata: {
        brand: brandProfile.company_name,
        tone: brandProfile.tone_of_voice,
        audience: brandProfile.target_audience,
      },
    })
  } catch (error) {
    console.error('Auto-generate content error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
