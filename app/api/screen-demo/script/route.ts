import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.slice(7))
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { description, durationSeconds } = await req.json()
    const dur = Number(durationSeconds)
    const hasDur = isFinite(dur) && dur >= 3 && dur <= 600
    // Natural VO pace ≈ 2.3 words/sec; leave ~10% breathing room.
    const wordBudget = hasDur ? Math.max(15, Math.round(dur * 2.3 * 0.9)) : null
    if (!description || typeof description !== 'string' || description.trim().length < 5) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Write a punchy voiceover script for a screen recording demo ad.
${hasDur
  ? `\nCRITICAL LENGTH: the recording is EXACTLY ${Math.round(dur)} seconds long. At natural speaking pace the script must be ~${wordBudget} words — NEVER more (the voiceover would get cut off mid-sentence), and not far under (dead air). Count your words. Land the CTA right at the end.`
  : '\nTarget 20–30 seconds spoken (under 200 words).'}

App/product: ${description.trim()}

Rules:
- Conversational, natural spoken language — not marketing fluff
- Hook in the first sentence (problem or result, not a greeting)
- Show 2–3 key benefits visible in a typical screen recording
- End with a clear CTA (try it, sign up, download, etc.)
- NO stage directions, NO [pause], NO (music), just the spoken words

Return ONLY the script text, nothing else.`,
      }],
    })

    const script = (msg.content[0] as { type: string; text: string }).text?.trim() ?? ''
    return NextResponse.json({ script })
  } catch (err) {
    console.error('[screen-demo/script]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Script generation failed' },
      { status: 500 },
    )
  }
}
