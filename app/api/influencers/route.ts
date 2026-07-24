// Influencer Studio — create + list persistent AI characters.
//
// POST body: { description } — freeform description of the influencer.
//   Sonnet expands it into an identity sheet (name, handle, bio,
//   personality, niche, appearance_prompt), then Nano Banana Pro renders
//   the canonical portrait. Costs INFLUENCER_CREATE_CR credits.
// GET — list the user's influencers with photo counts.
//
// Admin-gated: only ADMIN_EMAILS accounts can use this surface.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { generateNanoBananaImage } from '@/lib/nanobanana'
import { generateCharacterSheet } from '@/lib/character-sheet'
import { deductCredits } from '@/lib/deduct-credits'
import { canAccessInfluencerStudio } from '@/lib/pov-access'

export const maxDuration = 120

export const INFLUENCER_CREATE_CR = 18        // Sonnet + 2× NB Pro (portrait + sheet) ≈ $0.32 raw × 1.4
export const INFLUENCER_CREATE_NB2_CR = 11    // same flow on Nano Banana 2 ≈ $0.19 raw × 1.4
// 4-candidate picker flow: 4 portraits upfront, only chosen one keeps its
// sheet render. ≈ 4 NB Pro + 1 sheet vs 1 portrait + 1 sheet in the old flow.
export const INFLUENCER_CANDIDATES_CR = 34
export const INFLUENCER_CANDIDATES_NB2_CR = 20

// Four expression / vibe cues that give the user real choice between the
// candidates instead of four identical direct-look portraits. Each is a
// short additive clause tacked onto the Sonnet-generated appearance prompt.
export const CANDIDATE_VIBES = [
  { key: 'warm', cue: 'Expression: warm slight smile, direct eye contact. Real individual face with distinctive features and slight asymmetries — NOT the generic plastic AI-influencer look. Real skin texture (faint pores, subtle unevenness).' },
  { key: 'laughing', cue: 'Expression: caught mid-laugh, eyes crinkled at the corners, looking slightly off-camera as if reacting to someone just out of frame. Individual face with real character — teeth not perfectly straight, laugh lines showing. NOT the plastic AI-model laugh; a real spontaneous moment.' },
  { key: 'pensive', cue: 'Expression: soft neutral pensive look, three-quarter turn away from camera, eyes soft and thoughtful, lips slightly parted. Distinctive features (specific nose shape, individual eye shape). NOT a blank generic beauty face.' },
  { key: 'playful', cue: 'Expression: playful smirk with a knowing raised eyebrow, one hand near the face or in the hair, head slightly tilted. Real character in the face — asymmetric smile, individual quirks. NOT the generic AI-influencer glass-doll pose.' },
] as const

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function authAdmin(request: NextRequest): Promise<{ userId: string } | null> {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const { data } = await supa().auth.getUser(header.slice(7))
  if (!data.user) return null
  if (!canAccessInfluencerStudio(data.user.email)) return null
  return { userId: data.user.id }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authAdmin(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supa()
      .from('user_influencers')
      .select('id, name, handle, bio, personality, niche, portrait_url, character_sheet_url, created_at, last_used_at')
      .eq('user_id', auth.userId)
      .order('last_used_at', { ascending: false })
      .limit(100)
    if (error) throw error

    return NextResponse.json({ influencers: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

const IDENTITY_SYSTEM = `You are a casting director + social media strategist creating a fictional AI influencer from a client's freeform description.

Return ONLY valid JSON, no markdown, exactly this shape:
{
  "name": "First Last — natural, believable, matches the vibe",
  "handle": "@lowercase_handle no spaces",
  "bio": "1-2 sentence public bio in their own voice, no hashtags",
  "personality": "2-3 sentences: energy, humor style, how they talk to camera",
  "niche": "what they post about, 3-8 words",
  "appearance_prompt": "a detailed Nano Banana Pro image prompt for their canonical portrait"
}

appearance_prompt rules:
- Adult in their early-to-mid 20s, attractive and photogenic — but a REAL-person kind of attractive, not a retouched model
- Describe: gender presentation, ethnicity, hair (color/length/texture), eye color, distinctive features (freckles, dimples, glasses…), build, one signature style element
- Head-and-shoulders portrait, looking directly at the camera lens, natural expression with warmth
- Hyper-realistic candid snapshot with the look of a casual smartphone photo: bright even natural window light, deep focus (no bokeh, no shallow depth of field), true-to-life colours, healthy skin without acne / active blemishes / rough patches. NOT beauty-filter over-smoothed either — real skin still has faint pores, tiny freckles, slight redness at the nose or cheeks, individual character. The goal is a REAL attractive person, not the generic AI-influencer face (plastic-glossy skin, dead-symmetrical features, over-styled hair, taffy-smooth complexion).\n- The appearance_prompt MUST make the person feel SPECIFIC AND INDIVIDUAL — describe distinctive features (a slightly crooked nose, one raised eyebrow, a small mole above the lip, sharp cheekbones, a wide-set gaze, a soft jaw). Real beauty carries asymmetry and personality. AVOID: dead-symmetrical faces, glass-doll skin, generic Instagram-model beauty, over-groomed hair, blank pretty faces without character. AIM FOR: a real attractive human who could actually exist — think a real friend who's genuinely good-looking, not a stock-photo influencer.
- If the character presents as female (or the client didn't specify), give her a MINIMUM of natural makeup — clean base with a soft skin-toned foundation, a few coats of mascara defining the lashes, subtle eyebrow shape, a wash of natural blush on the cheeks, a tinted lip balm or nude satin lip. Not heavy glam, no cut crease eyeshadow, no dramatic contour — just the "polished but effortless" makeup a real attractive UGC creator wears on a normal day. If the character presents as male, groom him — clean skin, well-shaped brows, moisturised lips, healthy hair.
- The prompt must end with: 'Full-bleed photograph only — no camera interface, no shutter button, no viewfinder overlay, no on-screen text, no app UI, no watermark.'
- NEVER use the words 'phone camera', 'selfie', or 'screenshot' — they cause camera-app UI to render into the image
- NEVER include age numbers, brand names, or the words 'young' or 'girl'
- Honor every physical trait the client explicitly asked for`

export async function POST(request: NextRequest) {
  try {
    const auth = await authAdmin(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = supa()

    const body = await request.json()
    const description = String(body?.description ?? '').trim().slice(0, 1500)
    // Structured traits from the create form. Every provided trait is a hard
    // lock that Sonnet must honor in the identity sheet.
    const traits = {
      name: typeof body?.name === 'string' ? body.name.trim().slice(0, 60) : '',
      gender: typeof body?.gender === 'string' ? body.gender.slice(0, 30) : '',
      ageRange: typeof body?.ageRange === 'string' ? body.ageRange.slice(0, 12) : '',
      styles: Array.isArray(body?.styles) ? body.styles.map(String).slice(0, 5) : [],
      hairColor: typeof body?.hairColor === 'string' ? body.hairColor.slice(0, 30) : '',
      eyeColor: typeof body?.eyeColor === 'string' ? body.eyeColor.slice(0, 30) : '',
      ethnicity: typeof body?.ethnicity === 'string' ? body.ethnicity.slice(0, 40) : '',
      hairstyle: typeof body?.hairstyle === 'string' ? body.hairstyle.slice(0, 40) : '',
      faceFeatures: Array.isArray(body?.faceFeatures) ? body.faceFeatures.map(String).slice(0, 6) : [],
    }
    const model: 'pro' | 'nb2' = body?.model === 'nb2' ? 'nb2' : 'pro'
    const createCost = model === 'nb2' ? INFLUENCER_CANDIDATES_NB2_CR : INFLUENCER_CANDIDATES_CR
    const hasTraits = !!(traits.gender || traits.ageRange || traits.styles.length || traits.hairColor || traits.eyeColor || traits.hairstyle || traits.faceFeatures.length || traits.ethnicity)
    if (description.length < 10 && !hasTraits) {
      return NextResponse.json({ error: 'Pick some traits or describe your influencer' }, { status: 400 })
    }
    // Optional reference images: real photos whose look the influencer
    // should be based on. Capped at 3 to stay under request-size limits.
    const referenceImages: Array<{ base64: string; mimeType: string }> = Array.isArray(body?.referenceImages)
      ? body.referenceImages
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((r: any) => typeof r?.base64 === 'string' && r.base64.length > 100 && typeof r?.mimeType === 'string')
          .slice(0, 3)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((r: any) => ({ base64: r.base64, mimeType: r.mimeType }))
      : []

    // Credits check
    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', auth.userId)
      .maybeSingle()
    if (!credits || credits.balance < createCost) {
      return NextResponse.json({ error: `Insufficient credits. Need ${createCost}.` }, { status: 402 })
    }

    // 1) Sonnet expands the description into an identity sheet. If the
    // client attached reference photos, Sonnet sees them and writes the
    // appearance_prompt to match the person/look in those photos.
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const userContent: Anthropic.ContentBlockParam[] = referenceImages.map(r => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: r.mimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
        data: r.base64,
      },
    }))
    const traitLines: string[] = []
    if (traits.name) traitLines.push(`- Name: "${traits.name}" — use this EXACT name`)
    if (traits.gender) traitLines.push(`- Gender: ${traits.gender}`)
    if (traits.ethnicity) traitLines.push(`- Ethnicity: ${traits.ethnicity}`)
    if (traits.ageRange) traitLines.push(`- Age range: ${traits.ageRange} (express as a life-stage vibe in the appearance_prompt — never numeric ages)`)
    if (traits.styles.length) traitLines.push(`- Style & aesthetic: ${traits.styles.join(', ')}`)
    if (traits.hairColor) traitLines.push(`- Hair color: ${traits.hairColor}`)
    if (traits.eyeColor) traitLines.push(`- Eye color: ${traits.eyeColor}`)
    if (traits.hairstyle) traitLines.push(`- Hairstyle: ${traits.hairstyle}`)
    if (traits.faceFeatures.length) traitLines.push(`- Face features: ${traits.faceFeatures.join(', ')} — all must be visible in the appearance_prompt`)
    const traitsBlock = traitLines.length
      ? `\n\nLOCKED TRAITS — the client explicitly selected these; honor every one exactly in the identity sheet and appearance_prompt:\n${traitLines.join('\n')}`
      : ''
    userContent.push({
      type: 'text',
      text: (referenceImages.length
        ? `Client description of the influencer:\n${description || '(traits only)'}\n\nThe attached photo${referenceImages.length > 1 ? 's show' : ' shows'} the exact look the influencer should be based on — write the appearance_prompt to describe THIS person's face, hair, features, and style faithfully (adult, no age numbers).`
        : `Client description of the influencer:\n${description || '(traits only — build the character from the locked traits below)'}`) + traitsBlock,
    })
    // Retry Sonnet on transient 5xx / overloaded — Anthropic occasionally returns
    // api_error "Internal server error" and eating the credits + failing the
    // whole create flow over a blip is a bad UX.
    let msg: Awaited<ReturnType<typeof anthropic.messages.create>> | null = null
    let sonnetErr: unknown = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        msg = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 800,
          system: IDENTITY_SYSTEM,
          messages: [{ role: 'user', content: userContent }],
        })
        break
      } catch (e) {
        sonnetErr = e
        const status = (e as { status?: number })?.status
        if (status && status < 500 && status !== 429) break
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)))
      }
    }
    if (!msg) {
      console.error('[influencers] Sonnet failed after retries:', sonnetErr)
      return NextResponse.json({ error: 'Identity model is temporarily overloaded — try again in a moment.' }, { status: 503 })
    }
    const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim()
      .replace(/^```json?\n?/i, '').replace(/\n?```$/, '')
    let sheet: { name?: string; handle?: string; bio?: string; personality?: string; niche?: string; appearance_prompt?: string }
    try { sheet = JSON.parse(raw) } catch {
      return NextResponse.json({ error: 'Identity generation failed, try rewording' }, { status: 500 })
    }
    if (!sheet.appearance_prompt || !sheet.name) {
      return NextResponse.json({ error: 'Identity sheet incomplete, try again' }, { status: 500 })
    }
    // Client-picked name always wins over Sonnet's invention.
    if (traits.name) sheet.name = traits.name

    // 2) Nano Banana renders FOUR candidate portraits with distinct emotion
    // cues so the user gets meaningful choice instead of four near-identical
    // direct-look portraits. User picks one → /finalize renders the sheet
    // from that pick and saves the influencer.
    const portraitResults = await Promise.allSettled(
      CANDIDATE_VIBES.map(v => generateNanoBananaImage(`${sheet.appearance_prompt}\n\n${v.cue}`, {
        style: 'realistic',
        ratio: '4:5',
        model,
        referenceImages: referenceImages.length ? referenceImages : undefined,
        referenceHint: referenceImages.length
          ? 'The person in the attached reference photo(s) IS this character — preserve their exact face, hair, skin tone, and distinctive features. Apply the prompt as framing + expression around them; do NOT invent a different person.'
          : undefined,
      })),
    )
    // Upload every successful candidate to storage in parallel.
    const timestamp = Date.now()
    const candidates: Array<{ url: string; vibe: string }> = []
    for (let i = 0; i < portraitResults.length; i++) {
      const r = portraitResults[i]
      if (r.status !== 'fulfilled') {
        console.warn('[influencers/candidates] portrait', i, 'failed:', r.reason instanceof Error ? r.reason.message : r.reason)
        continue
      }
      const filename = `influencers/${auth.userId}-${timestamp}-candidate-${i}.png`
      const { error: upErr } = await supabase.storage
        .from('ugc-assets')
        .upload(filename, Buffer.from(r.value.imageBase64, 'base64'), { contentType: r.value.mimeType, upsert: false })
      if (upErr) continue
      candidates.push({
        url: supabase.storage.from('ugc-assets').getPublicUrl(filename).data.publicUrl,
        vibe: CANDIDATE_VIBES[i].key,
      })
    }
    if (!candidates.length) {
      return NextResponse.json({ error: 'All candidate portraits failed — try again.' }, { status: 500 })
    }

    // 3) Persist the original user reference photos to storage so future
    // photoshoots can anchor to them directly (prevents drift over time).
    const referenceUrls: string[] = []
    for (let i = 0; i < Math.min(referenceImages.length, 3); i++) {
      const r = referenceImages[i]
      const ext = r.mimeType.includes('png') ? 'png' : r.mimeType.includes('webp') ? 'webp' : 'jpg'
      const refPath = `influencers/${auth.userId}-${Date.now()}-ref-${i}.${ext}`
      const { error: refErr } = await supabase.storage
        .from('ugc-assets')
        .upload(refPath, Buffer.from(r.base64, 'base64'), { contentType: r.mimeType, upsert: false })
      if (refErr) {
        console.warn('[influencers] reference upload failed, skipping:', refErr.message)
        continue
      }
      referenceUrls.push(supabase.storage.from('ugc-assets').getPublicUrl(refPath).data.publicUrl)
    }

    // 4) Charge for the four candidates now. Sheet render is included in
    // this cost — /finalize doesn't charge again.
    const { newBalance, newPackCredits } = await deductCredits(
      supabase, auth.userId, createCost, credits.balance, credits.pack_credits ?? 0,
    )
    await supabase.from('user_credits')
      .update({ balance: newBalance, pack_credits: newPackCredits })
      .eq('user_id', auth.userId)

    // Return the identity draft + the 4 candidates. The client shows the
    // grid; user picks one and POSTs to /api/influencers/finalize with the
    // chosen candidate + this identity blob. That's when we render the
    // character sheet and insert the user_influencers row.
    return NextResponse.json({
      identity: {
        name: sheet.name,
        handle: sheet.handle ?? null,
        bio: sheet.bio ?? null,
        personality: sheet.personality ?? null,
        niche: sheet.niche ?? null,
        appearance_prompt: sheet.appearance_prompt,
      },
      candidates,
      referenceUrls,
      model,
      creditsCharged: createCost,
    }, { status: 201 })
  } catch (err) {
    console.error('[influencers] create failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
