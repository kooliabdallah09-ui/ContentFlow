import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/deduct-credits'
import { generateNanoBananaImage } from '@/lib/nanobanana'
import { loadBrandContext, formatBrandPrompt } from '@/lib/brand-context'

export const maxDuration = 300

const CREDIT_PER_SLIDE = 5        // Nano Banana Pro
const CREDIT_PER_SLIDE_NB2 = 3    // Nano Banana 2 — cheaper, less accurate

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
    illustrationDesc,
    referenceImageBase64,
    referenceImageMimeType,
    influencerId,
    model: modelRaw,
  } = await request.json()
  const model: 'pro' | 'nb2' = modelRaw === 'nb2' ? 'nb2' : 'pro'

  if (!topic?.trim()) {
    return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
  }

  const safeSlideCount = Math.max(3, Math.min(10, Number(slideCount) || 5))
  const totalCost = safeSlideCount * (model === 'nb2' ? CREDIT_PER_SLIDE_NB2 : CREDIT_PER_SLIDE)

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

  if (balance < totalCost) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
  }

  await deductCredits(supabase, userId, totalCost, balance, packCredits)

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const toneGuide =
    tone === 'bold'         ? 'Bold, punchy, attention-grabbing. Short sentences. Strong verbs. No filler.' :
    tone === 'informative'  ? 'Clear, educational, trustworthy. Lead with facts and value.' :
    tone === 'playful'      ? 'Fun, energetic, personable. Light tone with wit and personality.' :
    tone === 'professional' ? 'Polished, credible, authoritative. Formal but engaging.' :
                              'Engaging and persuasive.'

  const platformGuide =
    platform === 'linkedin' ? 'LinkedIn: professionals and decision-makers. Prioritise ROI, career value, industry insights. Slightly longer copy is fine.' :
    platform === 'tiktok'   ? 'TikTok Photo Mode: Gen-Z, fast-scroll. Ultra-short punchy text per slide (1 line max). Bold hook slide, quick payoff, punchline finish. Feels native to short-form video culture.' :
    platform === 'facebook' ? 'Facebook: broad audience, conversational. 2-3 lines per slide, direct benefit-driven copy, invites engagement.' :
                              'Instagram: visual-first, lifestyle-driven. Keep text tight — 1-2 punchy lines per slide.'

  const brandCtx = await loadBrandContext(supabase, userId)
  const brandBlock = formatBrandPrompt(brandCtx)

  // Optional: feature one of the user's AI influencers on the slides.
  // Their character sheet + portrait become Nano Banana identity refs and
  // Haiku is told to write imagePrompts around a recurring on-camera person.
  let influencer: { appearance_prompt: string; portrait_url: string; character_sheet_url?: string | null } | null = null
  let influencerRefs: Array<{ base64: string; mimeType: string }> = []
  if (typeof influencerId === 'string' && influencerId.length > 0) {
    const { data: inf } = await supabase
      .from('user_influencers')
      .select('appearance_prompt, portrait_url, character_sheet_url')
      .eq('id', influencerId)
      .eq('user_id', userId)
      .maybeSingle()
    if (inf) {
      influencer = inf
      const refUrls = [inf.character_sheet_url, inf.portrait_url].filter(
        (u): u is string => typeof u === 'string' && u.startsWith('http'),
      )
      influencerRefs = (await Promise.all(refUrls.map(async url => {
        try {
          const r = await fetch(url)
          if (!r.ok) return null
          return {
            base64: Buffer.from(await r.arrayBuffer()).toString('base64'),
            mimeType: r.headers.get('content-type') || 'image/png',
          }
        } catch { return null }
      }))).filter((x): x is { base64: string; mimeType: string } => !!x)
    }
  }
  const illDesc: string = typeof illustrationDesc === 'string' ? illustrationDesc.trim() : ''
  const illustrationBlock = illDesc
    ? `\nILLUSTRATION STYLE (user-provided — every slide's imagePrompt must follow this direction):\n${illDesc}\n`
    : ''
  const influencerBlock = influencer
    ? `\nRECURRING PERSON: the slides feature the same creator throughout. Write every imagePrompt as a scene featuring THIS person doing something relevant to the slide's point (holding, using, reacting, demonstrating) — lifestyle photography of the creator, not abstract graphics. Do not describe their physical appearance in the imagePrompt (the image model receives their photos separately).\n`
    : ''

  const copyPrompt = `You are an expert social media carousel creator for ${platform}.
${brandBlock}${illustrationBlock}${influencerBlock}
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
    slideSpecs.map(slide => {
      let finalPrompt = illDesc
        ? `${illDesc}. Slide subject: ${slide.imagePrompt}`
        : slide.imagePrompt
      if (influencer) {
        finalPrompt = `${influencer.appearance_prompt}\n\nScene for this slide: ${slide.imagePrompt}\n\nHyper-realistic candid snapshot of this exact person — natural face, no plastic face, no AI-smooth skin, real skin texture, bright even light, no camera interface, no watermark.`
      }
      const extraRefs = referenceImageBase64 && referenceImageMimeType
        ? [{ base64: referenceImageBase64 as string, mimeType: referenceImageMimeType as string }]
        : []
      return generateNanoBananaImage(finalPrompt, {
        model,
        style: influencer ? 'realistic' : 'professional',
        ratio: platform === 'tiktok' ? '9:16' : platform === 'linkedin' ? '1:1' : '4:5',
        referenceImages: influencerRefs.length ? [...influencerRefs, ...extraRefs] : undefined,
        referenceHint: influencerRefs.length
          ? `The FIRST reference image(s) define this exact person — same face, hair, skin tone, build in the output.${extraRefs.length ? ' The LAST image shows a product/object to incorporate faithfully.' : ''} Apply the prompt as scene + framing around them.`
          : undefined,
        referenceImageBase64: influencerRefs.length ? undefined : (referenceImageBase64 || undefined),
        referenceImageMimeType: influencerRefs.length ? undefined : (referenceImageMimeType || undefined),
      })
    })
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

  const { data: saved } = await supabase.from('ugc_content').insert([{
    user_id: userId,
    content_type: 'carousel',
    storage_url: null,
    metadata: {
      topic: topic.trim(),
      platform,
      tone,
      slideCount: safeSlideCount,
      slides: slides.map(s => ({ headline: s.headline, body: s.body, cta: s.cta })),
      generatedAt: new Date().toISOString(),
    },
    credit_cost: totalCost,
    status: 'completed',
  }]).select('id').maybeSingle()

  return NextResponse.json({ id: saved?.id ?? null, slides, creditsUsed: totalCost })
}
