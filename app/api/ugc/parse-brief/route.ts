// POST /api/ugc/parse-brief
//
// Turns a natural-language ad brief ("skincare ad, mid-20s brunette, morning
// routine, 10s hero shot of the bottle at the end") into a structured field
// patch the UGCBuilderV2 chat UI can merge into its state.
//
// Sonnet is instructed to return JSON only, with a strict schema.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface PatchShape {
  productName?: string
  productDescription?: string
  creatorName?: string
  format?: string
  aspect?: 'portrait' | 'square' | 'landscape' | 'tall45'
  duration?: 5 | 10 | 15 | 20 | 30
  resolution?: '480p' | '720p' | '1080p' | '4k'
  engine?: 'seedance-2' | 'seedance-2-5' | 'seedance-mini'
  direction?: string
  language?: string
  musicMood?: string
  scrollStopHook?: boolean
}

export async function POST(request: NextRequest) {
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
  const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.slice(7))
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const brief = typeof body?.brief === 'string' ? body.brief.slice(0, 2000).trim() : ''
  if (!brief) return NextResponse.json({ error: 'Missing brief' }, { status: 400 })

  const currentJson = safeCurrentSnapshot(body?.current)

  const system = `You extract UGC ad settings from a short natural-language brief.

Return a strict JSON object with only the fields you can infer with high confidence.
Do not invent details the user didn't specify. Omit fields you're unsure about.

SCHEMA (all fields optional):
{
  "productName": string,            // the product being advertised, if mentioned
  "productDescription": string,     // one sentence, only if the brief describes what it does
  "creatorName": string,            // person description ("mid-20s brunette", "male 30s"), or "Auto" if unspecified
  "format": string,                 // "Testimonial", "Unboxing", "POV", "Hot take", "Day in the life", "Hero shot", etc.
  "aspect": "portrait" | "square" | "landscape" | "tall45",
  "duration": 5 | 10 | 15 | 20 | 30,   // seconds — round to closest valid value
  "resolution": "720p" | "1080p" | "4k",
  "engine": "seedance-2" | "seedance-2-5" | "seedance-mini",   // mini = fast/cheap, 2.0 = default quality, 2.5 = premium (best motion, physics, prompt adherence)
  "direction": string,              // 1-3 sentences distilling scene, camera, tone, ending — this is what the model uses to shape the shot
  "language": string,               // "English", "French", "Spanish", "Arabic", etc.
  "musicMood": string,              // "upbeat" | "chill" | "cinematic" — only if explicitly requested
  "scrollStopHook": boolean         // true only if the user says "scroll-stopper", "hook", or similar
}

INFERENCE RULES
- If the brief mentions "TikTok", "reel", "story", "vertical", "9:16" → aspect: "portrait"
- "square", "1:1", "feed post" → "square"
- "YouTube", "landscape", "16:9", "widescreen" → "landscape"
- "quick", "fast", "cheap", "draft" → engine: "seedance-mini"
- "cinematic", "hero", "polished", "high quality" → engine: "seedance-2", resolution: "1080p" or "4k"
- "premium", "best", "top quality", "flagship", "2.5", "seedance 2.5" → engine: "seedance-2-5"
- Default duration is 10 unless user specifies otherwise
- Never set productName to a generic word like "product" — leave it blank if no real name given
- direction should capture the specific visual/narrative asks, not restate the whole brief

Return ONLY the JSON object. No prose, no markdown fences.`

  const userMsg = `Current state (for context only — do not repeat unchanged fields):
${currentJson}

New brief:
${brief}`

  try {
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system,
      messages: [{ role: 'user', content: userMsg }],
    })
    const text = resp.content
      .map(b => b.type === 'text' ? b.text : '')
      .join('\n')
      .trim()

    const patch = extractJson(text)
    if (!patch) {
      // Fall back to raw direction so we never leave the user empty-handed.
      return NextResponse.json({ direction: brief })
    }
    return NextResponse.json(coerce(patch))
  } catch (err) {
    console.error('[parse-brief] error', err)
    return NextResponse.json({ direction: brief })
  }
}

function safeCurrentSnapshot(cur: unknown): string {
  if (!cur || typeof cur !== 'object') return '{}'
  const c = cur as Record<string, unknown>
  const trimmed = {
    productName: c.productName || null,
    creatorName: c.creatorName || null,
    format: c.format || null,
    aspect: c.aspect || null,
    duration: c.duration || null,
    resolution: c.resolution || null,
    engine: c.engine || null,
    language: c.language || null,
  }
  return JSON.stringify(trimmed)
}

function extractJson(text: string): PatchShape | null {
  // Handle both raw JSON and accidentally-fenced JSON.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidate = (fenced?.[1] ?? text).trim()
  try {
    const parsed = JSON.parse(candidate)
    return typeof parsed === 'object' && parsed ? parsed as PatchShape : null
  } catch {
    // Try to locate a JSON object substring as a last resort.
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try { return JSON.parse(candidate.slice(start, end + 1)) as PatchShape } catch { /* nope */ }
    }
    return null
  }
}

function coerce(p: PatchShape): PatchShape {
  const out: PatchShape = {}
  if (typeof p.productName === 'string' && p.productName.trim()) out.productName = p.productName.trim().slice(0, 80)
  if (typeof p.productDescription === 'string' && p.productDescription.trim()) out.productDescription = p.productDescription.trim().slice(0, 400)
  if (typeof p.creatorName === 'string' && p.creatorName.trim()) out.creatorName = p.creatorName.trim().slice(0, 80)
  if (typeof p.format === 'string' && p.format.trim()) out.format = p.format.trim().slice(0, 40)
  if (p.aspect && ['portrait', 'square', 'landscape', 'tall45'].includes(p.aspect)) out.aspect = p.aspect
  if (typeof p.duration === 'number') {
    const valid = [5, 10, 15, 20, 30]
    const nearest = valid.reduce((a, b) => Math.abs(b - p.duration!) < Math.abs(a - p.duration!) ? b : a)
    out.duration = nearest as 5 | 10 | 15 | 20 | 30
  }
  if (p.resolution && ['480p', '720p', '1080p', '4k'].includes(p.resolution)) out.resolution = p.resolution
  if (p.engine && ['seedance-2', 'seedance-2-5', 'seedance-mini'].includes(p.engine)) out.engine = p.engine
  if (typeof p.direction === 'string' && p.direction.trim()) out.direction = p.direction.trim().slice(0, 800)
  if (typeof p.language === 'string' && p.language.trim()) out.language = p.language.trim().slice(0, 30)
  if (typeof p.musicMood === 'string' && p.musicMood.trim()) out.musicMood = p.musicMood.trim().slice(0, 30)
  if (typeof p.scrollStopHook === 'boolean') out.scrollStopHook = p.scrollStopHook
  return out
}
