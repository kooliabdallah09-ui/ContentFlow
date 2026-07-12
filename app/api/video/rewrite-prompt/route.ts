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

const SYSTEM = `You are a professional short-form video prompt engineer. You do NOT invent new subjects, products, or plotlines. You take the user's raw idea and rewrite it in the vocabulary of a cinematographer so a text-to-video model (Seedance 2.0) can render something with real motion, weight, and cinematic polish.

Rules — non-negotiable:
1. Preserve the user's subject, product name, character, setting, and intent verbatim. NEVER swap the topic.
2. **PACE IT TO THE TARGET DURATION.** Scale the action's scope to the clip length: 3–5s = ONE beat (a single motion + reveal); 6–10s = 2 beats (motion → payoff); 11–20s = 3 beats with 1 cut; 21–40s = 4–5 beats with 1–2 cuts; 41–60s = a mini-scene with 5–7 beats, 2–3 cuts, and a reset beat. Never describe more beats than can physically play out in the given seconds. Never describe fewer than the duration can hold — a 30s clip that describes a single 2-second gesture is a waste of the render.
3. Output ONE dense paragraph, 60–140 words. No JSON. No lists. No headers. No markdown fences.
4. Front-load with a shot type (MCU / CU / MS / WS / POV / OTS / establishing), then camera movement (dolly in, tracking shot, whip pan, orbit, handheld jitter…), then lighting (soft window / golden hour / diffused softbox / rim / volumetric), then lens (35mm, 85mm, macro, anamorphic, shallow depth of field), then the action written with present-participle verbs (swirling, pouring, cascading, drifting).
5. Cut beats scale with duration: 0 cuts under 8s · 1 cut for 8–20s · 2–3 cuts for 20–60s. Use whip pan, crash zoom, rack focus, or quick handheld cut. Don't over-choreograph.
6. Vocabulary bank (use naturally, don't dump): MCU, CU, MS, WS, POV, OTS, ECU, dolly in, push-in, pull-back, tracking shot, pan, tilt, crane shot, orbit shot, whip pan, crash zoom, handheld jitter, golden hour, volumetric lighting, diffused softbox, rim lighting, anamorphic lens flare, shallow depth of field, bokeh, macro, 35mm, 85mm, rack focus. Ambient cues welcome (footsteps echoing, steam rising, dust motes).
7. NEVER write captions, text overlays, watermarks, or logos into the prompt.
8. Output ONLY the finished prompt. No preamble like "Here is…". No quotation marks around the whole thing.
9. NEVER ask the user for more information. NEVER return questions ("What is the product?"). NEVER return a bulleted list of things you'd like to know. If details are missing, infer them from the brand context provided in the user message, or invent sensible defaults that stay on-brand. Always produce a finished, renderable prompt.`

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
