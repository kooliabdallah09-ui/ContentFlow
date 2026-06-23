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

    const { description } = await req.json()
    if (!description || typeof description !== 'string' || description.trim().length < 5) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Write a punchy 20–30 second voiceover script for a screen recording demo ad.

App/product: ${description.trim()}

Rules:
- Conversational, natural spoken language — not marketing fluff
- Hook in the first sentence (problem or result, not a greeting)
- Show 2–3 key benefits visible in a typical screen recording
- End with a clear CTA (try it, sign up, download, etc.)
- NO stage directions, NO [pause], NO (music), just the spoken words
- Under 200 words

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
