// Cinematographer prompt rewriter — used by the Video generator's prompt
// textarea. Given whatever the user typed, Claude Haiku returns a tighter
// version written in the cinematographer vocabulary (shot type, camera
// movement, lighting, lens, kinetic verbs). Stays strictly on-topic:
// preserves the user's subject, product, and intent — only adds cinematic
// specificity so Seedance 2.0 renders something solid instead of flat.
//
// Fail-soft: on any error we return the raw prompt.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

const SYSTEM = `You are a short-form ADVERTISING video prompt engineer. Your job is to turn the user's raw idea into an engaging, scroll-stopping social ad prompt for Seedance 2.0 — not a moody art film. Think TikTok / Reels ad breaks: quick hook, product on-screen, clear payoff, real people, phone-camera authenticity.

Rules — non-negotiable:
1. Preserve the user's subject, product name, character, setting, and intent verbatim. NEVER swap the topic.
2. **PACE IT TO THE TARGET DURATION.** 3–5s = ONE beat (hook or single product reveal). 6–10s = 2 beats (hook → product payoff). 11–20s = 3 beats with 1 cut (hook → demo → CTA-worthy moment). 21–40s = 4–5 beats with 1–2 cuts. 41–60s = mini-ad with 5–7 beats, 2–3 cuts. Never describe more beats than can physically play out. Don't waste a 30s slot on a 2-second gesture.
3. Output ONE dense paragraph, 60–140 words. No JSON. No lists. No headers. No markdown fences.
4. Advertising priorities in order — LEAD with the hook (a scroll-stopping first-second action), show the PRODUCT clearly on-screen, land a specific benefit/reaction, close on the CTA-worthy beat. Product visibility beats moody atmosphere.
5. Aesthetic default is UGC / social ad: handheld phone-camera framing, natural indoor light, real skin texture, casual wardrobe, authentic reaction — NOT film noir, NOT anamorphic cinema. Only go polished-studio if the brand tone is luxury.
6. Camera + lens vocabulary is fine but use it LIGHTLY: MCU / CU / MS / POV / OTS, quick push-in, handheld jitter, whip-pan to a beat, snap to product close-up, rack focus. Skip crane shots, volumetric god rays, high-contrast noir, and film grain unless the raw idea calls for it.
7. Motion in present-participle verbs (pouring, applying, holding, revealing). Ambient cues welcome (kitchen morning light, steam rising, a satisfying "clean" sound). Native audio is on — a spoken hook or reaction line is welcome inside the paragraph as "the character says '…'".
8. NEVER write captions, text overlays, watermarks, or logos into the prompt.
9. Output ONLY the finished prompt. No preamble like "Here is…". No quotation marks around the whole thing.
10. NEVER ask the user for more information. NEVER return questions or bulleted "what would you like" lists. Infer from the brand context, or invent sensible on-brand defaults. Always output a finished, renderable prompt.`

export async function POST(request: NextRequest) {
  let raw = ''
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
    raw = String(body?.prompt ?? '').slice(0, 3000).trim()
    if (raw.length < 4) return NextResponse.json({ prompt: raw })

    const durationHint = Math.max(3, Math.min(60, Number(body?.duration ?? 5)))
    const aspectHint = String(body?.aspect ?? 'portrait')

    // Load the user's brand profile so the rewriter grounds the prompt in
    // their actual product, tone, and audience instead of asking questions
    // back ("what is the product?"). Fail-soft — if no brand exists yet we
    // still rewrite, we just skip the brand block.
    const { data: brand } = await supabase
      .from('brand_profiles')
      .select('company_name, description, product_type, unique_value_prop, brand_mission, target_audience, tone_of_voice, customer_pain_points')
      .eq('user_id', userData.user.id)
      .maybeSingle()
    const brandBlock = brand ? `
Brand context (use naturally as concrete detail — the product, the audience, the tone. NEVER ask the user for these; they're given):
- Company: ${brand.company_name ?? ''}
- Product / description: ${brand.description ?? ''} (${brand.product_type ?? ''})
- Unique value: ${brand.unique_value_prop ?? ''}
- Audience: ${brand.target_audience ?? ''}
- Tone of voice: ${brand.tone_of_voice ?? ''}
- Mission: ${brand.brand_mission ?? ''}
- Pain points: ${brand.customer_pain_points ?? ''}
`.trim() : ''

    // Derive an explicit beat + cut budget so Claude doesn't have to guess.
    const beatBudget =
      durationHint <= 5  ? '1 beat, 0 cuts'
      : durationHint <= 10 ? '2 beats, 0–1 cut'
      : durationHint <= 20 ? '3 beats, 1 cut'
      : durationHint <= 40 ? '4–5 beats, 1–2 cuts'
      :                      '5–7 beats, 2–3 cuts, one reset beat'

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `Raw idea from user:
"""${raw}"""

${brandBlock}

Target clip length: ${durationHint} seconds (STRICT — pace the action to fill this exact duration, no more, no less).
Beat budget for this length: ${beatBudget}.
Format: ${aspectHint}.

Rewrite it for Seedance 2.0. Use the brand context as the concrete subject — DO NOT ask the user for product / setting / tone; that context is already given above.`,
      }],
    })
    const enhanced = (msg.content[0] as { type: 'text'; text: string }).text.trim()
      .replace(/^```(?:text)?\n?/i, '').replace(/\n?```$/, '')
      .replace(/^["'`]|["'`]$/g, '')
      .trim()
    return NextResponse.json({ prompt: enhanced || raw, source: enhanced ? 'claude' : 'fallback' })
  } catch (err) {
    console.warn('[video/rewrite-prompt] falling back:', err instanceof Error ? err.message : err)
    return NextResponse.json({ prompt: raw, source: 'fallback' })
  }
}
