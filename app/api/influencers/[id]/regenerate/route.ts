// Regenerate an existing influencer's look — runs Sonnet with the CURRENT
// identity prompt language against the influencer's stored traits, then
// renders 4 fresh candidate portraits. User picks one via the same modal
// as create; /finalize updates the row in place (portrait_url,
// character_sheet_url, appearance_prompt) and deletes the old artifacts.
//
// Same cost as create — this is essentially a re-run of the candidates
// phase against a stored identity draft.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { generateNanoBananaImage } from '@/lib/nanobanana'
import { deductCredits } from '@/lib/deduct-credits'
import { canAccessInfluencerStudio } from '@/lib/pov-access'
import { CANDIDATE_VIBES, INFLUENCER_CANDIDATES_CR, INFLUENCER_CANDIDATES_NB2_CR } from '@/app/api/influencers/route'

export const maxDuration = 120

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// System prompt for the regeneration Sonnet call. The key difference from
// the create IDENTITY_SYSTEM is that we anchor to the EXISTING character's
// name/handle/personality/niche and only rewrite the appearance_prompt
// with the new "real individual, minimal makeup" language.
const REGEN_SYSTEM = `You are rewriting the visual APPEARANCE PROMPT for an existing AI influencer. Their name, handle, bio, personality, and niche are already locked and must be preserved — you only rewrite the appearance description with fresh photorealistic language.

Return ONLY valid JSON, no markdown:
{
  "appearance_prompt": "a detailed Nano Banana Pro image prompt for their canonical portrait"
}

appearance_prompt rules:
- Head-and-shoulders portrait, looking directly at the camera lens, natural expression with warmth.
- Describe: gender presentation, ethnicity, hair (color / length / texture), eye color, distinctive features (freckles, dimples, glasses, a small mole, sharp cheekbones, wide-set gaze — SPECIFIC and individual), build, one signature style element.
- Hyper-realistic candid smartphone photograph energy: bright even natural window light, deep focus (no bokeh), true-to-life colours, healthy skin without acne / active blemishes / rough patches. Skin still has REAL texture — faint pores, tiny freckles, subtle unevenness, slight redness at nose or cheeks. NOT plastic AI-influencer glass-doll skin.
- Make the person feel SPECIFIC AND INDIVIDUAL — slight asymmetries, distinctive features that make them recognisable. AVOID the generic AI-influencer template (dead-symmetrical, over-groomed, cookie-cutter Instagram beauty).
- If the character presents as female, give her a MINIMUM of natural makeup — clean base with soft skin-toned foundation, a few coats of mascara defining the lashes, subtle eyebrow shape, a wash of natural blush, tinted lip balm or nude satin lip. Not heavy glam, no dramatic contour, no cut crease eyeshadow — the "polished but effortless" everyday makeup a real attractive UGC creator wears. If male, groom him — clean skin, well-shaped brows, moisturised lips.
- The prompt must end with: 'Full-bleed photograph only — no camera interface, no shutter button, no viewfinder overlay, no on-screen text, no app UI, no watermark.'
- NEVER use the words 'phone camera', 'selfie', or 'screenshot'.
- NEVER include age numbers, brand names, or the words 'young' or 'girl'.
- Honor every physical trait present in the existing appearance description below — only refine the language, don't swap the character out.`

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const header = request.headers.get('Authorization')
    if (!header?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = supa()
    const { data: userData } = await supabase.auth.getUser(header.slice(7))
    if (!userData.user || !canAccessInfluencerStudio(userData.user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = userData.user.id
    const { id } = await params

    const body = await request.json().catch(() => ({}))
    const model: 'pro' | 'nb2' = body?.model === 'nb2' ? 'nb2' : 'pro'
    const cost = model === 'nb2' ? INFLUENCER_CANDIDATES_NB2_CR : INFLUENCER_CANDIDATES_CR

    const { data: influencer } = await supabase
      .from('user_influencers')
      .select('id, name, handle, bio, personality, niche, appearance_prompt, reference_urls')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (!influencer) return NextResponse.json({ error: 'Influencer not found' }, { status: 404 })

    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .maybeSingle()
    if (!credits || credits.balance < cost) {
      return NextResponse.json({ error: `Insufficient credits. Need ${cost}.` }, { status: 402 })
    }

    // Pull the original user reference photos if we have them — we want the
    // regen anchored to real photos, not the drifted portrait.
    const originalRefs: Array<{ base64: string; mimeType: string }> = []
    if (Array.isArray(influencer.reference_urls)) {
      for (const url of (influencer.reference_urls as string[]).slice(0, 3)) {
        if (typeof url !== 'string' || !url.startsWith('http')) continue
        try {
          const r = await fetch(url)
          if (!r.ok) continue
          originalRefs.push({
            base64: Buffer.from(await r.arrayBuffer()).toString('base64'),
            mimeType: r.headers.get('content-type') || 'image/png',
          })
        } catch { /* ignore */ }
      }
    }

    // 1) Sonnet rewrites the appearance prompt only, preserving the rest.
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const contextBlock = `EXISTING CHARACTER:
Name: ${influencer.name}
Handle: ${influencer.handle ?? '(none)'}
Bio: ${influencer.bio ?? '(none)'}
Personality: ${influencer.personality ?? '(none)'}
Niche: ${influencer.niche ?? '(none)'}
Current appearance description (rewrite this — preserve the physical traits, refresh the language):
${influencer.appearance_prompt}`
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: REGEN_SYSTEM,
      messages: [{ role: 'user', content: contextBlock }],
    })
    const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim()
      .replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '')
    let sheet: { appearance_prompt?: string }
    try { sheet = JSON.parse(raw) } catch {
      return NextResponse.json({ error: 'Appearance rewrite failed — try again.' }, { status: 500 })
    }
    if (!sheet.appearance_prompt) {
      return NextResponse.json({ error: 'Appearance rewrite incomplete — try again.' }, { status: 500 })
    }

    // 2) Render 4 candidate portraits with the same expression cues as create.
    // Always use nb2 for candidate previews — finalize renders at the chosen quality.
    const nbOpts = {
      style: 'realistic' as const,
      ratio: '4:5' as const,
      model: 'nb2' as const,
      referenceImages: originalRefs.length ? originalRefs : undefined,
      referenceHint: originalRefs.length
        ? 'The person in the attached reference photo(s) IS this character — preserve their exact face, hair, skin tone, and distinctive features. Apply the prompt as framing + expression around them; do NOT invent a different person.'
        : undefined,
    }
    // Generate candidates sequentially — Vertex quota can't handle parallel bursts.
    const timestamp = Date.now()
    const candidates: Array<{ url: string; vibe: string }> = []
    for (let i = 0; i < CANDIDATE_VIBES.length; i++) {
      const v = CANDIDATE_VIBES[i]
      const prompt = `${sheet.appearance_prompt}\n\n${v.cue}`
      let result: Awaited<ReturnType<typeof generateNanoBananaImage>> | null = null
      try {
        result = await generateNanoBananaImage(prompt, nbOpts)
      } catch (err) {
        console.warn('[influencers/regenerate] portrait', i, 'failed:', err instanceof Error ? err.message : err)
        continue
      }
      const filename = `influencers/${userId}-${timestamp}-regen-${i}.png`
      const { error: upErr } = await supabase.storage
        .from('ugc-assets')
        .upload(filename, Buffer.from(result.imageBase64, 'base64'), { contentType: result.mimeType, upsert: false })
      if (upErr) {
        console.warn('[influencers/regenerate] upload failed for', i, upErr.message)
        continue
      }
      candidates.push({
        url: supabase.storage.from('ugc-assets').getPublicUrl(filename).data.publicUrl,
        vibe: CANDIDATE_VIBES[i].key,
      })
    }
    if (!candidates.length) {
      return NextResponse.json({ error: 'Portrait generation failed — please try again.' }, { status: 500 })
    }

    // 3) Charge upfront. /finalize will update the row and clean up old
    // artifacts without charging again.
    const { newBalance, newPackCredits } = await deductCredits(
      supabase, userId, cost, credits.balance, credits.pack_credits ?? 0,
    )
    await supabase.from('user_credits').update({ balance: newBalance, pack_credits: newPackCredits }).eq('user_id', userId)

    // Client gets everything it needs to call /finalize with an
    // updateInfluencerId so the row is REPLACED not created.
    return NextResponse.json({
      identity: {
        name: influencer.name,
        handle: influencer.handle,
        bio: influencer.bio,
        personality: influencer.personality,
        niche: influencer.niche,
        appearance_prompt: sheet.appearance_prompt,
      },
      candidates,
      referenceUrls: Array.isArray(influencer.reference_urls) ? influencer.reference_urls : [],
      model,
      updateInfluencerId: influencer.id,
      creditsCharged: cost,
    })
  } catch (err) {
    console.error('[influencers/regenerate] failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
