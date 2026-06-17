import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface HookVariant {
  id: string
  angle: string
  tone: string
  text: string
}

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.slice(7))
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { productName, productDescription, benefits, productImageBase64, productImageMimeType, customInstructions } = body

    if (!productName || !productDescription || !benefits) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Length-cap to prevent prompt-injection via giant payloads.
    const safeCustom = typeof customInstructions === 'string'
      ? customInstructions.slice(0, 1500).trim()
      : ''
    const customBlock = safeCustom
      ? `\nUSER INSTRUCTIONS (priority — match these in tone and content):\n${safeCustom}\n`
      : ''

    const textPrompt = `Write 3 distinct UGC hook openings for a 30-second social ad about "${productName}".

Product: ${productName}
Description: ${productDescription}
Key benefits: ${benefits}
${customBlock}
Each hook is the FIRST 5 SECONDS of the video — the spoken line that grabs attention. Use THREE different angles, one per hook:

1. PROBLEM angle — call out the pain point or frustration the viewer already feels
2. RESULT angle — lead with the transformation/outcome, make them want what you have
3. CURIOSITY angle — bold claim, surprising question, or pattern interrupt that demands they keep watching

Return ONLY valid JSON in this exact shape, no markdown, no commentary:
{
  "hooks": [
    { "angle": "Problem", "tone": "short tone note like 'frustrated, relatable'", "text": "spoken hook line (under 15 words)" },
    { "angle": "Result", "tone": "...", "text": "..." },
    { "angle": "Curiosity", "tone": "...", "text": "..." }
  ]
}

Rules:
- text must sound like a real person speaking, not an ad
- under 15 words each
- no emojis, no hashtags, no "you guys", no "POV:"
- avoid the literal product name in the hook — tease the benefit instead${safeCustom ? `\n- USER INSTRUCTIONS above override tone defaults — match them` : ''}`

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: productImageBase64
          ? [
              { type: 'image' as const, source: { type: 'base64' as const, media_type: (productImageMimeType ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp', data: productImageBase64 } },
              { type: 'text' as const, text: textPrompt },
            ]
          : textPrompt,
      }],
    })

    const raw = (msg.content[0] as { text: string }).text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Hook generation returned malformed output' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0]) as { hooks: Array<{ angle: string; tone: string; text: string }> }
    const hooks: HookVariant[] = parsed.hooks.slice(0, 3).map((h, i) => ({
      id: `hook-${i + 1}`,
      angle: h.angle,
      tone: h.tone,
      text: h.text,
    }))

    return NextResponse.json({ hooks }, { status: 200 })
  } catch (error) {
    console.error('Hook generation error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Hook generation failed' }, { status: 500 })
  }
}
