import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { SMART } from '@/lib/ai-models'
import { checkRateLimit } from '@/lib/rate-limit'
import { HOOK_BANNED, HOOK_VOICE_EXAMPLES } from '@/lib/hook-formulas'
import { PLAN_FORMATS } from '@/lib/planner-playbook'
import { PLANNER_DURATIONS } from '@/lib/planner-cost'

// Writes the full script for one planned video, in the layout the video step
// reads, with the planned hook kept as the first spoken line. Free: credits are
// only taken when the video itself is rendered.

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const clock = (s: number) => `0:${String(Math.max(0, Math.round(s))).padStart(2, '0')}`

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    const header = request.headers.get('Authorization')
    if (!header?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = createClient(url, key)
    const { data: userData } = await supabase.auth.getUser(header.slice(7))
    const userId = userData.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limit = await checkRateLimit('planner-script', userId, 20, 60 * 1000)
    if (!limit.ok) return NextResponse.json({ error: 'Too many requests, try again in a minute' }, { status: 429 })

    const b = await request.json().catch(() => ({}))
    const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
    const productName = str(b.productName, 200)
    const productDescription = str(b.productDescription, 2000)
    const hook = str(b.hook, 200)
    const visual = str(b.visual, 300)
    const format = PLAN_FORMATS.find(f => f.label === b.format && f.kind === 'video')
    const d = (PLANNER_DURATIONS as readonly number[]).includes(Number(b.durationSeconds)) ? Number(b.durationSeconds) : 15
    if (!productName || !productDescription || !hook) return NextResponse.json({ error: 'Missing product or hook' }, { status: 400 })

    let brandBlock = ''
    try {
      const { data: brand } = await supabase.from('brand_profiles')
        .select('target_audience, tone_of_voice').eq('user_id', userId).maybeSingle()
      const lines = [
        brand?.target_audience?.trim() ? `Target audience: ${brand.target_audience.trim()}` : '',
        brand?.tone_of_voice?.trim() ? `Tone of voice: ${brand.tone_of_voice.trim()}` : '',
      ].filter(Boolean)
      if (lines.length) brandBlock = `\nBRAND CONTEXT:\n${lines.join('\n')}\n`
    } catch { /* non-fatal */ }

    const hookEnd = 2
    const ctaStart = d - 3
    const words = Math.round(d * 2.2)

    const prompt = `You write a ${d}-second UGC ad script, spoken to camera by one creator filmed on a phone.

Product: ${productName}
Description: ${productDescription}
${brandBlock}
Format to copy: ${format ? `${format.label}. ${format.skeleton}` : 'a natural talking-head review'}
Opening line (use it as the first spoken line, unchanged): "${hook}"
First frame: ${visual || 'a natural, slightly unexpected opening action'}

Use EXACTLY this layout (the video step reads it):

[BACKGROUND: one short phrase for where the creator is]

[HOOK — 0:00 to ${clock(hookEnd)}]
(stage direction for the first frame)
"${hook}"

[BODY — ${clock(hookEnd)} to ${clock(ctaStart)}]
(stage direction showing the product doing the thing)
"spoken lines"

[CTA — ${clock(ctaStart)} to ${clock(d)}]
(stage direction)
"one small, natural closing line"

Rules:
- About ${words} spoken words in total so it fits ${d} seconds. The body tells a small story with a beginning and a turn, not a list of features.
- The product is only named from the BODY on.
- Sounds like a real person talking. Never use: ${HOOK_BANNED.join(', ')}. No emojis, no hashtags, no "POV:", no "you guys".
- Never invent facts, prices, discounts, ratings or customer counts. Only use what the product info supports.
- No health, energy, focus, weight or performance effects (for example "I stay sharp", "no more crash") unless the product info states them. Describe what the product is and how it feels to use instead.

Voice and layout examples (other products, never copy):
${HOOK_VOICE_EXAMPLES}

Return ONLY the script text in that layout, no JSON and no commentary.`

    const msg = await anthropic.messages.create({ ...SMART, max_tokens: 1500, messages: [{ role: 'user', content: prompt }] })
    const script = msg.content.filter((x): x is Anthropic.TextBlock => x.type === 'text').map(x => x.text).join('').trim()
    if (!/\[HOOK/i.test(script) || !/\[BODY/i.test(script) || !/\[CTA/i.test(script)) {
      return NextResponse.json({ error: 'The script writer returned an unexpected layout, try again' }, { status: 500 })
    }
    return NextResponse.json({ script })
  } catch (err) {
    console.error('[planner] script', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Script writing failed' }, { status: 500 })
  }
}
