import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { SMART } from '@/lib/ai-models'
import { getLanguage } from '@/lib/languages'
import { checkRateLimit } from '@/lib/rate-limit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const maxDuration = 60

// The angles a hook can take. A batch picks the first N, so the most
// broadly useful ones come first.
export const HOOK_ANGLES = [
  { key: 'problem', label: 'Problem', brief: 'Call out the pain or frustration the viewer already feels.' },
  { key: 'result', label: 'Result', brief: 'Lead with the outcome or transformation they want.' },
  { key: 'curiosity', label: 'Curiosity', brief: 'A surprising claim or question that makes them keep watching.' },
  { key: 'proof', label: 'Social proof', brief: 'A "everyone is asking me about this" or "I switched and..." moment.' },
  { key: 'before-after', label: 'Before / after', brief: 'Contrast how things were before the product with how they are now.' },
  { key: 'objection', label: 'Objection', brief: 'Say the doubt out loud ("I thought it was a gimmick") and flip it.' },
] as const

export interface HookScript {
  key: string
  label: string
  script: string
}

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
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
    const userId = userData.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limit = await checkRateLimit('hook-batch', userId, 10, 60 * 1000)
    if (!limit.ok) return NextResponse.json({ error: 'Too many requests, try again in a minute' }, { status: 429 })

    const body = await request.json()
    const productName = typeof body.productName === 'string' ? body.productName.trim().slice(0, 200) : ''
    const productDescription = typeof body.productDescription === 'string' ? body.productDescription.trim().slice(0, 2000) : ''
    const benefits = typeof body.benefits === 'string' ? body.benefits.trim().slice(0, 1500) : ''
    if (!productName || !(productDescription || benefits)) {
      return NextResponse.json({ error: 'Add a product name and a short description' }, { status: 400 })
    }
    const count = Math.min(Math.max(Number(body.count) || 3, 1), HOOK_ANGLES.length)
    const angles = HOOK_ANGLES.slice(0, count)
    const language = getLanguage(typeof body.language === 'string' ? body.language : undefined)

    // Same brand context the single-script route uses.
    let brandBlock = ''
    try {
      const { data: brand } = await supabase
        .from('brand_profiles')
        .select('target_audience, tone_of_voice')
        .eq('user_id', userId)
        .maybeSingle()
      const lines = [
        brand?.target_audience?.trim() ? `Target audience: ${brand.target_audience.trim()}` : '',
        brand?.tone_of_voice?.trim() ? `Tone of voice: ${brand.tone_of_voice.trim()}` : '',
      ].filter(Boolean)
      if (lines.length) brandBlock = `\nBRAND CONTEXT:\n${lines.join('\n')}\n`
    } catch { /* non-fatal */ }

    const languageBlock = language.code !== 'en'
      ? `\nWrite every spoken line in ${language.name}. Keep the bracketed labels in English.\n`
      : ''

    const prompt = `You write short UGC ad scripts, spoken to camera by one creator filmed on a phone.

Product: ${productName}
Description: ${productDescription}
Key benefits: ${benefits || productDescription}
${brandBlock}${languageBlock}
Write ${angles.length} different 5-second scripts for this product. Each one uses a DIFFERENT hook angle:
${angles.map((a, i) => `${i + 1}. ${a.label}: ${a.brief}`).join('\n')}

Every script must use EXACTLY this layout (the video step reads it):

[BACKGROUND: one short phrase for where the creator is]

[HOOK — 0:00 to 0:01]
(one short stage direction)
"spoken line"

[BODY — 0:01 to 0:04]
(one short stage direction)
"spoken line"

[CTA — 0:04 to 0:5]
(one short stage direction)
"spoken line"

Rules:
- About 12 to 16 spoken words in total per script, so it fits 5 seconds.
- Sounds like a real person talking, not an ad. No emojis, no hashtags, no "POV:", no "you guys".
- Never invent facts, prices, discounts, ratings or customer counts. Only use what the product info above supports.
- Do not repeat the same opening words across scripts.

Return ONLY valid JSON, no markdown:
{ "scripts": [ ${angles.map(a => `{ "key": "${a.key}", "script": "..." }`).join(', ')} ] }`

    const msg = await anthropic.messages.create({
      ...SMART,
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Script writer returned malformed output' }, { status: 500 })

    const parsed = JSON.parse(jsonMatch[0]) as { scripts?: Array<{ key?: string; script?: string }> }
    const byKey = new Map((parsed.scripts ?? []).map(s => [s.key, s.script]))
    const hooks: HookScript[] = angles
      .map(a => ({ key: a.key, label: a.label, script: (byKey.get(a.key) ?? '').trim() }))
      .filter(h => h.script.length > 0)
    if (!hooks.length) return NextResponse.json({ error: 'No scripts came back, try again' }, { status: 500 })

    return NextResponse.json({ hooks })
  } catch (error) {
    console.error('hook-batch error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Hook batch failed' }, { status: 500 })
  }
}
