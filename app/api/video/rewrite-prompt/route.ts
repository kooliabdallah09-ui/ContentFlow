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
2. Output ONE dense paragraph, 60–140 words. No JSON. No lists. No headers. No markdown fences.
3. Front-load with a shot type (MCU / CU / MS / WS / POV / OTS / establishing), then camera movement (dolly in, tracking shot, whip pan, orbit, handheld jitter…), then lighting (soft window / golden hour / diffused softbox / rim / volumetric), then lens (35mm, 85mm, macro, anamorphic, shallow depth of field), then the action written with present-participle verbs (swirling, pouring, cascading, drifting).
4. When useful, add ONE cut beat — a whip pan, crash zoom, rack focus, or quick handheld cut — but don't over-choreograph.
5. Vocabulary bank (use naturally, don't dump): MCU, CU, MS, WS, POV, OTS, ECU, dolly in, push-in, pull-back, tracking shot, pan, tilt, crane shot, orbit shot, whip pan, crash zoom, handheld jitter, golden hour, volumetric lighting, diffused softbox, rim lighting, anamorphic lens flare, shallow depth of field, bokeh, macro, 35mm, 85mm, rack focus. Ambient cues welcome (footsteps echoing, steam rising, dust motes).
6. NEVER write captions, text overlays, watermarks, or logos into the prompt.
7. Output ONLY the finished prompt. No preamble like "Here is…". No quotation marks around the whole thing.`

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

    const durationHint = Number(body?.duration ?? 5)
    const aspectHint = String(body?.aspect ?? 'portrait')

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `Raw idea from user:\n"""${raw}"""\n\nTarget duration: ~${durationHint}s. Format: ${aspectHint}. Rewrite it for Seedance 2.0.`,
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
