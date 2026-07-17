// Director mode for the standalone Video generator.
//
// POST { intent, durationSeconds, aspect, engine } →
//   1. Sonnet expands the one-line intent into a full timestamped Seedance
//      prompt (shot types, camera moves, lighting, beat budget) + three
//      keyframe descriptions, honoring the user's brand context.
//   2. Nano Banana 2 renders the three keyframes as a cheap storyboard so
//      the user can see the direction BEFORE spending video credits.
// Returns { prompt, keyframes: [urls] }. Costs DIRECT_CR credits.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { generateNanoBananaImage } from '@/lib/nanobanana'
import { deductCredits } from '@/lib/deduct-credits'

export const maxDuration = 120

export const DIRECT_CR = 10   // Sonnet direction + 3 NB2 storyboard frames

const SYSTEM = `You are an expert commercial video director and Seedance 2.0 prompt engineer. You turn a one-line intent into ONE polished, timestamped Seedance 2.0 prompt for a cinematic short-form clip (TikTok/Reels/YouTube).

Rules for the video prompt:
- Timestamped scene blocks: SCENE N [MM:SS – MM:SS] with Visual: lines (Dialogue only if the intent implies speech). Scene count by duration: <=5s 1 scene · 6-10s 2 · 11-20s 3 · 21-40s 4-5 · 41-60s 5-7. The last scene's end equals the target duration EXACTLY.
- Every scene specifies: shot type (MCU/CU/WS/POV/orbit/macro…), camera move (push-in, dolly, whip pan, tracking, handheld drift…), lighting, and motion described in present-participle verbs.
- Hyper-realistic, natural light or motivated practical light, real textures. No text overlays, no watermarks, no logos.
- HARD CAP: the prompt must stay under 3400 characters.

Also produce THREE keyframe image prompts (opening frame, midpoint frame, final frame) — each a single dense sentence describing exactly what that still looks like: subject, framing, lighting, environment. They must be visually consistent with each other and with the video prompt (same subject, same environment progression).

Return ONLY valid JSON, no markdown:
{"prompt": "...", "keyframes": ["opening…", "midpoint…", "final…"]}`

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
    const userId = userData.user.id

    const body = await request.json()
    const intent = String(body?.intent ?? '').trim().slice(0, 600)
    if (intent.length < 5) return NextResponse.json({ error: 'Describe your video in a sentence' }, { status: 400 })
    const duration = Math.max(3, Math.min(60, Number(body?.durationSeconds) || 10))
    const aspect: 'portrait' | 'square' | 'landscape' =
      body?.aspect === 'square' || body?.aspect === 'landscape' ? body.aspect : 'portrait'

    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .maybeSingle()
    if (!credits || credits.balance < DIRECT_CR) {
      return NextResponse.json({ error: `Insufficient credits. Need ${DIRECT_CR}.` }, { status: 402 })
    }

    // Brand context (best-effort) so bare intents still come out on-brand.
    let brandBlock = ''
    try {
      const { data: brand } = await supabase
        .from('brand_profiles')
        .select('company_name, description, tone_of_voice, target_audience')
        .eq('user_id', userId)
        .maybeSingle()
      if (brand?.company_name) {
        brandBlock = `\n\nBrand context (apply the tone; don't name the brand unless the intent does): ${brand.company_name} — ${brand.description ?? ''}. Tone: ${brand.tone_of_voice ?? 'authentic'}. Audience: ${brand.target_audience ?? ''}.`
      }
    } catch { /* optional */ }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1800,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `INTENT: ${intent}\nTARGET DURATION: exactly ${duration} seconds.\nASPECT: ${aspect} (${aspect === 'landscape' ? '16:9' : aspect === 'square' ? '1:1' : '9:16 vertical'}).${brandBlock}\n\nDirect it now.`,
      }],
    })
    const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim()
      .replace(/^```json?\n?/i, '').replace(/\n?```$/, '')
    let parsed: { prompt?: string; keyframes?: string[] }
    try { parsed = JSON.parse(raw) } catch {
      return NextResponse.json({ error: 'Direction failed to parse — try rewording' }, { status: 500 })
    }
    const videoPrompt = String(parsed.prompt ?? '').slice(0, 3600)
    const keyframePrompts = (Array.isArray(parsed.keyframes) ? parsed.keyframes : []).map(String).slice(0, 3)
    if (!videoPrompt || keyframePrompts.length < 3) {
      return NextResponse.json({ error: 'Incomplete direction — try again' }, { status: 500 })
    }

    // Storyboard: 3 cheap NB2 keyframes in parallel.
    const nbRatio = aspect === 'landscape' ? '16:9' as const : aspect === 'square' ? '1:1' as const : '9:16' as const
    const results = await Promise.allSettled(keyframePrompts.map(p =>
      generateNanoBananaImage(
        `${p}\n\nCinematic film still, hyper-realistic, natural textures, no text, no watermark, no camera interface.`,
        { model: 'nb2', style: 'realistic', ratio: nbRatio },
      ),
    ))
    const keyframes: string[] = []
    for (const r of results) {
      if (r.status !== 'fulfilled') continue
      const filename = `video-ref/${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-storyboard.png`
      const { error: upErr } = await supabase.storage
        .from('ugc-assets')
        .upload(filename, Buffer.from(r.value.imageBase64, 'base64'), { contentType: r.value.mimeType, upsert: false })
      if (!upErr) keyframes.push(supabase.storage.from('ugc-assets').getPublicUrl(filename).data.publicUrl)
    }
    if (!keyframes.length) {
      return NextResponse.json({ error: 'Storyboard rendering failed — try again' }, { status: 500 })
    }

    const { newBalance, newPackCredits } = await deductCredits(
      supabase, userId, DIRECT_CR, credits.balance, credits.pack_credits ?? 0,
    )
    await supabase.from('user_credits')
      .update({ balance: newBalance, pack_credits: newPackCredits })
      .eq('user_id', userId)

    return NextResponse.json({ prompt: videoPrompt, keyframes, creditsCharged: DIRECT_CR })
  } catch (err) {
    console.error('[video/direct] failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Direction failed' }, { status: 500 })
  }
}
