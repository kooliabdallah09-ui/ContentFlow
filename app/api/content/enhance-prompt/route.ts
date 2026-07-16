// Prompt enhancer — expand a bare content-plan hook into a rich, generator-
// specific prompt that includes camera work, character, scene, product cues,
// and brand tone. Called by the dashboard + calendar "Generate" buttons
// right before we savePrefill and route to the target generator.
//
// Fail-soft: if Anthropic errors we return the original hook so the flow
// never breaks. Costs are tiny (~$0.0002 per call at Haiku prices).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

interface Body {
  hook: string
  format: string                     // grwm / unboxing / hot_take / …
  target: 'ugc' | 'video' | 'image' | 'social' | 'voice' | 'screen-demo'
  platform?: string
  duration?: number                  // seconds
}

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

    const body = (await request.json()) as Body
    const hook = String(body.hook ?? '').slice(0, 800).trim()
    const format = String(body.format ?? 'other').slice(0, 40)
    const target = String(body.target ?? 'ugc') as Body['target']
    const platform = String(body.platform ?? '').slice(0, 40) || 'tiktok'
    const duration = Number(body.duration ?? (target === 'video' ? 8 : 15))
    if (!hook) {
      return NextResponse.json({ prompt: '' })
    }

    // Load brand + intelligence context so the prompt echoes the user's
    // product, audience, and tone.
    const [{ data: brand }, { data: intel }] = await Promise.all([
      supabase.from('brand_profiles').select('*').eq('user_id', userData.user.id).maybeSingle(),
      supabase.from('user_intelligence').select('niche, audience_profile').eq('user_id', userData.user.id).maybeSingle(),
    ])

    const beatBudget =
      duration <= 5  ? '1 beat, 0 cuts'
      : duration <= 10 ? '2 beats, 0–1 cut'
      : duration <= 20 ? '3 beats, 1 cut'
      : duration <= 40 ? '4–5 beats, 1–2 cuts'
      :                  '5–7 beats, 2–3 cuts, one reset beat'

    const targetRules: Record<Body['target'], string> = {
      video: `TARGET: text-to-video model (Seedance 2.0). Describe:
- Shot type first (MCU / CU / MS / WS / POV / OTS / establishing)
- Camera work: dolly in, push-in, tracking, whip pan, orbit, handheld jitter
- Lighting: soft window / golden hour / diffused softbox / rim / volumetric
- Lens: 35mm, 85mm, macro, shallow depth of field, bokeh, anamorphic
- Motion in present-participle verbs (pouring, drifting, cascading, swirling)
- **Clip length: EXACTLY ${duration}s. Pace the action to fill this and no more.**
  Beat budget for ${duration}s: ${beatBudget}. Never describe more beats than
  the seconds can physically hold; never waste seconds on a single tiny gesture.

Keep it a single dense paragraph, 60-140 words. No captions, no on-screen text, no watermark, no logos.`,
      ugc: `TARGET: the "Video direction" one-liner field on the UGC generator (200-char limit). This is NOT a script — a downstream UGC-expert AI writes the full timestamped Seedance script from this hint plus the user's brand/onboarding data. Your job is to distill the concept into ONE short natural-language sentence describing the video's angle.

Output rules — read carefully:
- ONE sentence, at most ~120 characters. Never more than 200.
- NO "SETTING:", "OPENING LINE:", "DIALOGUE:" labels. NO scene breakdowns. NO verbatim quotes.
- NO character description (age, ethnicity, wardrobe) — the character is chosen elsewhere.
- Write it like a creator briefing themselves in plain English.

Good examples:
- "unboxing of the product on a kitchen counter, showing first reaction"
- "before/after in a bathroom mirror after one use"
- "quick demo of how the product actually works, hands-on"
- "why someone would switch to this from the drugstore version"
Bad examples (do NOT output anything like these):
- "SETTING: bright bathroom, phone propped… OPENING LINE: '…'"
- Any multi-sentence script or shot list.`,
      image: `TARGET: image generator (Nano Banana). Describe:
- Composition: hero shot / flat lay / lifestyle / close-up macro
- Lighting: soft window / golden hour / studio / clean e-comm
- Product hero: which product, angle, one supporting prop
- Colour palette: 2-3 tones
- Aspect ratio hint

Keep it 30-60 words, punchy and visual.`,
      social: `TARGET: social caption + hashtag generator. Return the CORE post idea in one sentence, then 5-8 relevant hashtags.
Keep total under 300 chars.`,
      voice: `TARGET: voiceover script (ElevenLabs). Write the exact verbatim script — no stage directions. Under ${duration} seconds spoken (~${Math.round(duration * 2.4)} words). Start with the hook.`,
      'screen-demo': `TARGET: screen-recording narration. Describe:
- Which screens/features to record in order (3-5 beats)
- What the on-screen action is per beat
- The one-line VO per beat

Total under ${duration} seconds. Keep it a walkthrough, not a pitch.`,
    }

    const brandBlock = brand ? `
Brand context (apply naturally, do not mention 'the brand'):
- Company: ${brand.company_name ?? ''}
- Product: ${brand.description ?? ''} (${brand.product_type ?? ''})
- Unique value: ${brand.unique_value_prop ?? ''}
- Audience: ${brand.target_audience ?? ''}
- Tone: ${brand.tone_of_voice ?? ''}
- Pain points: ${brand.customer_pain_points ?? ''}
`.trim() : ''

    const nicheBlock = intel?.niche ? `Niche: ${intel.niche}` : ''

    const prompt = `You are a short-form content director. Expand the raw hook below into a production-ready prompt for the target generator.

RAW HOOK: "${hook}"
FORMAT: ${format}
PLATFORM: ${platform}
${nicheBlock}
${brandBlock}

${targetRules[target]}

Output ONLY the finished prompt. No preamble. No 'Here is…'. No markdown.`

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: target === 'ugc' ? 120 : 500,
      messages: [{ role: 'user', content: prompt }],
    })
    let enhanced = (msg.content[0] as { type: 'text'; text: string }).text.trim()
    if (target === 'ugc') {
      enhanced = enhanced.replace(/^["'`]+|["'`]+$/g, '').replace(/\s+/g, ' ').slice(0, 200).trim()
    }
    return NextResponse.json({ prompt: enhanced || hook, source: enhanced ? 'claude' : 'fallback' })
  } catch (err) {
    // Never block generation on an enhancer failure — return the raw hook.
    console.warn('[enhance-prompt] falling back:', err instanceof Error ? err.message : err)
    try {
      const b = await request.json().catch(() => ({} as Body))
      return NextResponse.json({ prompt: String((b as Body).hook ?? ''), source: 'fallback' })
    } catch {
      return NextResponse.json({ prompt: '', source: 'fallback' })
    }
  }
}
