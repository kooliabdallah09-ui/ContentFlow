import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { FAST, SMART } from '@/lib/ai-models'
import { getLanguage } from '@/lib/languages'
import { checkRateLimit } from '@/lib/rate-limit'
import { HOOK_FORMULAS, HOOK_BANNED, HOOK_VOICE_EXAMPLES } from '@/lib/hook-formulas'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const maxDuration = 60

const MAX_HOOKS = 6

export interface HookScript {
  key: string
  label: string
  script: string
}

// A script must keep the layout the video step reads.
const hasLayout = (s: string) => /\[HOOK/i.test(s) && /\[BODY/i.test(s) && /\[CTA/i.test(s)
const isClean = (s: string) => {
  const lower = s.toLowerCase()
  return !HOOK_BANNED.some(w => lower.includes(w))
}
const parseJson = (raw: string) => {
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) return null
  try { return JSON.parse(m[0]) } catch { return null }
}
const textOf = (msg: Anthropic.Message) =>
  msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('').trim()

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
    const count = Math.min(Math.max(Number(body.count) || 3, 1), MAX_HOOKS)
    // Write about twice as many candidates as asked for, each with its own
    // formula, then let a critic pass keep the strongest.
    const candidateCount = Math.min(count * 2, HOOK_FORMULAS.length)
    const formulas = [...HOOK_FORMULAS].sort(() => Math.random() - 0.5).slice(0, candidateCount)
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

    const writerPrompt = `You write the opening of short UGC ads, spoken to camera by one creator filmed on a phone. The first second decides everything: it must stop a thumb that is already scrolling.

Product: ${productName}
Description: ${productDescription}
Key benefits: ${benefits || productDescription}
${brandBlock}${languageBlock}
Write ${formulas.length} different 5-second scripts. Script N uses formula N. A formula is a shape, not wording: make a fresh line for THIS product.

FORMULAS
${formulas.map((f, i) => `${i + 1}. ${f.label} (${f.key}): ${f.pattern}\n   Shape examples (other products, never copy): "${f.examples[0]}" / "${f.examples[1]}"`).join('\n')}

HOW A GOOD HOOK WORKS
- The hook is about the VIEWER, not the product. Do not name the product or brand in the HOOK beat: once it sounds like an ad, the viewer scrolls. Start from the viewer's situation, doubt or curiosity, then the BODY brings in the product.
- The first spoken line is under 9 words and does at least TWO of these: (a) asks or implies a question the viewer cannot leave unanswered, (b) is paired with something visually unexpected, (c) carries a specific credential, comparison or concrete detail (only facts the product info supports). No vague claims.
- The stage direction on the HOOK beat is a visual pattern interrupt visible in the very first frame: an odd action, an unexpected object, a reaction. Never "creator smiles and looks at camera".
- Say what a real person says to a friend, with a point of view. Fragments and blunt statements are fine.
- Body: show the product doing the thing. CTA: one small, natural line.

NEVER USE: ${HOOK_BANNED.join(', ')}; also no emojis, no hashtags, no "POV:", no "you guys", no questions that start with "Are you tired of".
Never invent facts, prices, discounts, ratings or customer counts. Only use what the product info supports.
Do not repeat the same opening words across scripts. About 12 to 16 spoken words in total per script.

EVERY script uses EXACTLY this layout (the video step reads it):

[BACKGROUND: one short phrase for where the creator is]

[HOOK — 0:00 to 0:01]
(one short stage direction, the visual pattern interrupt)
"spoken line"

[BODY — 0:01 to 0:04]
(one short stage direction)
"spoken line"

[CTA — 0:04 to 0:5]
(one short stage direction)
"spoken line"

VOICE AND LAYOUT EXAMPLES (other products, never copy):
${HOOK_VOICE_EXAMPLES}

Return ONLY valid JSON, no markdown:
{ "scripts": [ { "formula": "key", "script": "..." } ] }
Use these formula keys in order: ${formulas.map(f => f.key).join(', ')}`

    const written = await anthropic.messages.create({
      ...SMART,
      max_tokens: 4000,
      messages: [{ role: 'user', content: writerPrompt }],
    })
    const writtenJson = parseJson(textOf(written)) as { scripts?: Array<{ formula?: string; script?: string }> } | null
    if (!writtenJson) return NextResponse.json({ error: 'Script writer returned malformed output' }, { status: 500 })

    const labelByKey = new Map(formulas.map(f => [f.key, f.label]))
    const candidates = (writtenJson.scripts ?? [])
      .map(c => ({ key: String(c.formula ?? ''), script: String(c.script ?? '').trim() }))
      .filter(c => labelByKey.has(c.key) && hasLayout(c.script) && isClean(c.script))
    if (!candidates.length) return NextResponse.json({ error: 'No scripts came back, try again' }, { status: 500 })

    // Critic pass: score every candidate and keep the best `count`. If the
    // critic fails for any reason, fall back to the first `count`.
    let chosen = candidates.slice(0, count)
    if (candidates.length > count) {
      try {
        const criticPrompt = `You are a harsh short-form ad editor. Below are ${candidates.length} candidate openings for the product "${productName}". Score each from 1 to 10 on:
- stops the scroll in the first second (the first line AND the opening visual)
- about the viewer, not the product (naming the product in the first line is a penalty), and specific enough that it would not fit any product
- sounds like a real person, not an ad

Be strict: a generic line scores 4 or below. Prefer a set with different feelings over near-duplicates.

${candidates.map((c, i) => `#${i} [${c.key}]\n${c.script}`).join('\n\n')}

Return ONLY valid JSON: { "scores": [ { "i": 0, "score": 7 } ] } with one entry per candidate.`
        const judged = await anthropic.messages.create({
          ...FAST,
          max_tokens: 800,
          messages: [{ role: 'user', content: criticPrompt }],
        })
        const scores = (parseJson(textOf(judged)) as { scores?: Array<{ i?: number; score?: number }> } | null)?.scores ?? []
        const scoreOf = new Map(scores.map(x => [Number(x.i), Number(x.score) || 0]))
        const ranked = candidates
          .map((c, i) => ({ c, score: scoreOf.get(i) ?? 0, i }))
          .sort((a, b) => b.score - a.score || a.i - b.i)
        // Only trust the critic if it scored most of the candidates.
        if (scores.length >= candidates.length / 2) chosen = ranked.slice(0, count).map(r => r.c)
      } catch (e) {
        console.error('hook-batch critic failed, using first scripts:', e)
      }
    }

    const hooks: HookScript[] = chosen.map(c => ({ key: c.key, label: labelByKey.get(c.key) ?? c.key, script: c.script }))
    return NextResponse.json({ hooks })
  } catch (error) {
    console.error('hook-batch error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Hook batch failed' }, { status: 500 })
  }
}
