import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/deduct-credits'
import { generateNanoBananaImage } from '@/lib/nanobanana'

export const maxDuration = 300

const CREDIT_PER_SLIDE = 5

interface SlideSpec {
  headline: string
  body: string
  cta: string
  imagePrompt: string
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

  const {
    topic,
    platform = 'instagram',
    slideCount = 5,
    tone = 'bold',
    referenceImageBase64,
    referenceImageMimeType,
  } = await request.json()

  if (!topic?.trim()) {
    return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
  }

  const safeSlideCount = Math.max(3, Math.min(10, Number(slideCount) || 5))
  const totalCost = safeSlideCount * CREDIT_PER_SLIDE

  const { data: creditsRow } = await supabase
    .from('user_credits')
    .select('balance, pack_credits')
    .eq('user_id', userId)
    .single()

  if (!creditsRow || creditsRow.balance < totalCost) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
  }

  await deductCredits(supabase, userId, totalCost, creditsRow.balance, creditsRow.pack_credits)

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const toneGuide =
    tone === 'bold'         ? 'Bold, punchy, attention-grabbing. Short sentences. Strong verbs. No filler.' :
    tone === 'informative'  ? 'Clear, educational, trustworthy. Lead with facts and value.' :
    tone === 'playful'      ? 'Fun, energetic, personable. Light tone with wit and personality.' :
    tone === 'professional' ? 'Polished, credible, authoritative. Formal but engaging.' :
                              'Engaging and persuasive.'

  const platformGuide = platform === 'linkedin'
    ? 'LinkedIn: professionals and decision-makers. Prioritise ROI, career value, industry insights. Slightly longer copy is fine.'
    : 'Instagram: visual-first, lifestyle-driven. Keep text tight — 1-2 punchy lines per slide.'

  const copyPrompt = `You are an expert social media carousel creator for ${platform}.

Topic: ${topic}
Tone: ${toneGuide}
Platform: ${platformGuide}
Slides: ${safeSlideCount}

Structure:
- Slide 1: Hook — bold opening that stops the scroll
- Slides 2–${safeSlideCount - 1}: Value slides — one key point each, concrete and specific
- Slide ${safeSlideCount}: CTA / takeaway — clear next action

Return ONLY a JSON array of exactly ${safeSlideCount} objects (no markdown, no extra text):
[
  {
    "headline": "Short title, max 8 words",
    "body": "Supporting copy, max 20 words",
    "cta": "Action phrase max 5 words — only on the last slide, empty string on all others",
    "imagePrompt": "Visual description for AI image generation. Describe the mood, setting, subject, and lighting. Do NOT mention any text or words in the image. 1–2 sentences max."
  }
]`

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{ role: 'user', content: copyPrompt }],
  })

  const rawText = (msg.content[0] as { type: 'text'; text: string }).text.trim()
  let slideSpecs: SlideSpec[]
  try {
    let jsonText = rawText
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    }
    slideSpecs = JSON.parse(jsonText)
    if (!Array.isArray(slideSpecs)) throw new Error('Not an array')
    // Pad or trim to exact count
    while (slideSpecs.length < safeSlideCount) slideSpecs.push(slideSpecs[slideSpecs.length - 1])
    slideSpecs = slideSpecs.slice(0, safeSlideCount)
  } catch {
    return NextResponse.json({ error: 'Failed to parse slide copy from AI' }, { status: 500 })
  }

  const imageResults = await Promise.allSettled(
    slideSpecs.map(slide =>
      generateNanoBananaImage(slide.imagePrompt, {
        style: 'professional',
        ratio: platform === 'linkedin' ? '1:1' : '4:5',
        referenceImageBase64: referenceImageBase64 || undefined,
        referenceImageMimeType: referenceImageMimeType || undefined,
      })
    )
  )

  const slides = slideSpecs.map((spec, i) => {
    const result = imageResults[i]
    return {
      headline: spec.headline,
      body: spec.body,
      cta: spec.cta,
      imageBase64: result.status === 'fulfilled' ? result.value.imageBase64 : null,
      mimeType: result.status === 'fulfilled' ? result.value.mimeType : 'image/png',
    }
  })

  return NextResponse.json({ slides, creditsUsed: totalCost })
}
