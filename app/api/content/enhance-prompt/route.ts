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

    const targetRules: Record<Body['target'], string> = {
      video: `TARGET: text-to-video model (Seedance 2.0). Describe:
- The scene: setting, lighting (soft natural / dramatic / studio), time of day
- Camera work: static / slow push-in / handheld / tracking shot / crane
- Motion: what moves in the frame (product rotation, hand entering, fabric sway)
- Subject detail: age, ethnicity, wardrobe, product placement, one hero prop
- Mood: cinematic / cozy / editorial / gritty / glossy
- Duration cues: ${duration}s clip

Keep it a single dense paragraph, 60-120 words. No captions, no on-screen text, no watermark, no logos.`,
      ugc: `TARGET: UGC talking-head generator (Kling v3 lipsync). Describe:
- Character on camera: age, ethnicity, hair, one accessory, wardrobe vibe
- Setting: bedroom / kitchen / desk / bathroom / car — cozy, phone-camera framing
- What they say verbatim as the FIRST sentence (use the hook)
- Delivery: casual, one take, no rehearsed feel
- One gesture or product placement per beat

Keep it 40-90 words. Reads like a director's blocking note. Their exact opening line matters.`,
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
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })
    const enhanced = (msg.content[0] as { type: 'text'; text: string }).text.trim()
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
