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

export const maxDuration = 300

export const INFLUENCER_CREATE_CR = 18        // Sonnet + 2× NB Pro (portrait + sheet) ≈ $0.32 raw × 1.4
export const INFLUENCER_CREATE_NB2_CR = 11    // same flow on Nano Banana 2 ≈ $0.19 raw × 1.4
// 2-candidate picker flow: 2 portraits upfront, chosen one gets sheet render.
// ≈ 2 NB Pro + 1 sheet.
export const INFLUENCER_CANDIDATES_CR = 20
export const INFLUENCER_CANDIDATES_NB2_CR = 13

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

const IDENTITY_SYSTEM_V1 = `You are a casting director + social media strategist creating a fictional AI influencer from a client's freeform description.

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
- Hyper-realistic candid snapshot with the look of a casual smartphone photo: bright even natural window light, deep focus (no bokeh, no shallow depth of field), true-to-life colours. Skin is CLEAR, HEALTHY, and EVEN in tone — no visible moles, no active blemishes, no red patches on the nose or cheeks, no dark under-eyes. Very subtle real-skin micro-texture is fine (barely-there pores, soft natural sheen) — but do NOT add freckles, moles, redness, or "character marks" to the face unless the client explicitly asked for them. This is what separates a REAL beautiful person from AI-slop with random imperfections tacked on.\n- The person should feel SPECIFIC and INDIVIDUAL through STRUCTURE, not through flaws — describe distinctive bone structure (sharp cheekbones, defined jawline, elegant nose bridge, expressive brow, gentle chin), eye shape, lip shape, hair fall, and posture. Slight facial asymmetry is human and welcome. AVOID: adding moles, blemishes, red noses, freckle clusters, uneven skin, tired eyes; ALSO avoid the opposite extreme — plastic-glossy skin, dead-symmetrical features, filter-smoothed complexion, wax-doll perfection. AIM FOR: a genuinely attractive person who could book a real modelling job — polished but human.
- If the character presents as female (or the client didn't specify), give her LIGHT, FLATTERING natural makeup — clean skin-toned base evening out complexion, mascara defining the lashes, subtle soft eyeliner or tightlined lash line, groomed and lightly filled brows, a soft rose or peach blush lifting the cheekbones, a subtle highlight on cheekbones + brow bone + cupid's bow, and a nude satin lip with a hint of colour. Not full glam — no dramatic eyeshadow, no heavy contour, no cut crease, no false lashes — but noticeably polished, the way an attractive UGC creator posts on a good-lighting day. Skin should look healthy and radiant, not matte or flat. If the character presents as male, groom him meticulously — clear even skin, well-shaped brows, moisturised lips, healthy well-cut hair, a subtle hint of tinted lip balm is fine.
- The prompt must end with: 'Full-bleed photograph only — no camera interface, no shutter button, no viewfinder overlay, no on-screen text, no app UI, no watermark.'
- NEVER use the words 'phone camera', 'selfie', or 'screenshot' — they cause camera-app UI to render into the image
- NEVER include age numbers, brand names, or the words 'young' or 'girl'
- Honor every physical trait the client explicitly asked for
- For any trait NOT specified by the client (ethnicity, hairstyle, gender, etc.) make the best creative choice that fits the overall vibe — fill every gap, never leave a detail ambiguous
`

const IDENTITY_SYSTEM_V2 = `You are a creative director writing scene briefs for hyper-realistic UGC influencer portraits.

OUTPUT ONLY VALID JSON. Start your response with { and end with }. No text before or after the JSON object. No markdown. No explanation.

Return exactly this JSON shape:
{
  "name": "First Last",
  "handle": "@lowercase_handle",
  "bio": "1-2 sentence public bio in their own voice, no hashtags",
  "personality": "2-3 sentences: energy, humor, how they talk on camera",
  "niche": "what they post about, 3-8 words",
  "appearance_prompt": "scene brief text here"
}

The appearance_prompt must be one continuous string written in 4 dense paragraphs (no labels or headers, just the paragraphs separated by newlines):

First paragraph: Ultra-realistic vertical smartphone photo of [person: build, cultural background, hair color/length/texture, skin tone, eyes, lips, natural details like pores or slight imperfections]. They are [mid-action posture: leaning, reaching, gesturing — candid not posed]. Wearing [specific outfit: fabric, color, cut — e.g. a fitted cream ribbed crop top and loose black drawstring pants].

Second paragraph: Expression is [candid: mid-sentence, mid-laugh, direct eye contact with relaxed mouth open, shoulders loose]. Posture feels unposed and real — like a creator who just hit record and is already talking. [One individual detail: jawline, hair flyaways, collarbone, etc.]

Third paragraph: Setting is [specific home/lifestyle space: kitchen, bathroom, coffee shop — described with materials, colors, light source]. Feels lived-in and real, not staged. [2-3 specific props or background details: marble counter, brass tap, a plant, a mug.]

Fourth paragraph: Shot on an iPhone-style camera, vertical 9:16, [close medium or chest-height crop], wide-angle phone lens, realistic distortion, natural daylight from [direction], soft shadows, no studio lighting, no airbrushed skin, no beauty filter. Hyper-realistic skin texture with visible pores, natural hair flyaways, realistic fabric texture. Raw phone photo realism, high resolution, 9:16 aspect ratio.

HARD RULES:
- Your entire response must be valid JSON starting with { — do not write any words before the opening brace
- Honor every physical trait the client explicitly requested
- Fill every detail with a specific creative choice — no vague generalities
- Never write age numbers, brand names, the words young, girl, selfie, phone camera, or screenshot
- If reference photos are attached, base the person description on that person's face and style
`

// ─── Toggle: change to false to revert to V1 ─────────────────────────────
const USE_V2_PROMPTING = true
// ─────────────────────────────────────────────────────────────────────────

const IDENTITY_SYSTEM = USE_V2_PROMPTING ? IDENTITY_SYSTEM_V2 : IDENTITY_SYSTEM_V1

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
      hairstyle: typeof body?.hairstyle === 'string' ? body.hairstyle.slice(0, 40) : '',
      faceFeatures: Array.isArray(body?.faceFeatures) ? body.faceFeatures.map(String).slice(0, 6) : [],
    }
    const model: 'pro' | 'nb2' = body?.model === 'nb2' ? 'nb2' : 'pro'
    const createCost = model === 'nb2' ? INFLUENCER_CANDIDATES_NB2_CR : INFLUENCER_CANDIDATES_CR
    const hasTraits = !!(traits.gender || traits.ageRange || traits.styles.length || traits.hairColor || traits.eyeColor || traits.hairstyle || traits.faceFeatures.length)
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

    // First influencer is always free — check existing count.
    const { count: existingCount } = await supabase
      .from('user_influencers')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.userId)
    const isFreeFirstInfluencer = (existingCount ?? 0) === 0

    // Credits check — skipped for the free first influencer.
    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', auth.userId)
      .maybeSingle()
    if (!isFreeFirstInfluencer && (!credits || credits.balance < createCost)) {
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
        ? `Client note: "${description || '(use the photos)'}"\n\nThe attached photo${referenceImages.length > 1 ? 's are' : ' is'} the VISUAL REFERENCE — base the appearance_prompt entirely on THIS person's face, hair, features, build, and style as seen in the photos. The client note may just be a name or a short hint; that's fine, the photos carry the visual identity. Invent a plausible handle, bio, personality, and niche that fit the look. Write the appearance_prompt to faithfully describe what you see (adult framing, no age numbers).`
        : `Client description / additional details — MUST be honored in the identity sheet and appearance_prompt with equal weight to the locked traits below:\n${description || '(traits only — build the character from the locked traits below)'}`) + traitsBlock,
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
          max_tokens: 1500,
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
    const rawText = (msg.content[0] as { type: 'text'; text: string }).text.trim()
    // Extract JSON object from anywhere in the response — Claude sometimes adds a preamble.
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    const raw = jsonMatch ? jsonMatch[0] : rawText.replace(/^```json?\n?/i, '').replace(/\n?```$/, '')
    let sheet: { name?: string; handle?: string; bio?: string; personality?: string; niche?: string; appearance_prompt?: string }
    try { sheet = JSON.parse(raw) } catch {
      console.error('[influencers] JSON parse failed, raw response:', rawText.slice(0, 600))
      return NextResponse.json({ error: 'Identity generation failed, try rewording' }, { status: 500 })
    }
    if (!sheet.appearance_prompt || !sheet.name) {
      return NextResponse.json({ error: 'Identity sheet incomplete, try again' }, { status: 500 })
    }
    // Client-picked name always wins over Sonnet's invention.
    if (traits.name) sheet.name = traits.name

    // 2) Render 2 candidate portraits using the same prompt — NB Pro naturally
    // produces variation between runs. User picks the best one.
    const nbOpts = {
      style: 'realistic' as const,
      ratio: '4:5' as const,
      model,
      referenceImages: referenceImages.length ? referenceImages : undefined,
      referenceHint: referenceImages.length
        ? 'The person in the attached reference photo(s) IS this character — preserve their exact face, hair, skin tone, and distinctive features. Apply the prompt as framing + expression around them; do NOT invent a different person.'
        : undefined,
    }
    const timestamp = Date.now()
    const candidates: Array<{ url: string; vibe: string }> = []
    for (let i = 0; i < 1; i++) {
      let result: Awaited<ReturnType<typeof generateNanoBananaImage>> | null = null
      try {
        result = await generateNanoBananaImage(sheet.appearance_prompt, nbOpts)
      } catch (err) {
        console.warn('[influencers/candidates] portrait', i, 'failed:', err instanceof Error ? err.message : err)
        continue
      }
      const filename = `influencers/${auth.userId}-${timestamp}-candidate-${i}.png`
      const { error: upErr } = await supabase.storage
        .from('ugc-assets')
        .upload(filename, Buffer.from(result.imageBase64, 'base64'), { contentType: result.mimeType, upsert: false })
      if (upErr) {
        console.warn('[influencers/candidates] upload failed for', i, upErr.message)
        continue
      }
      candidates.push({
        url: supabase.storage.from('ugc-assets').getPublicUrl(filename).data.publicUrl,
        vibe: `option-${i + 1}`,
      })
    }
    if (!candidates.length) {
      return NextResponse.json({ error: 'Portrait generation failed — please try again.' }, { status: 500 })
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

    // 4) Charge for the four candidates now — skipped for the free first influencer.
    // Sheet render is included in this cost; /finalize doesn't charge again.
    if (!isFreeFirstInfluencer && credits) {
      const { newBalance, newPackCredits } = await deductCredits(
        supabase, auth.userId, createCost, credits.balance, credits.pack_credits ?? 0,
      )
      await supabase.from('user_credits')
        .update({ balance: newBalance, pack_credits: newPackCredits })
        .eq('user_id', auth.userId)
    }

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
      creditsCharged: isFreeFirstInfluencer ? 0 : createCost,
      freeFirstInfluencer: isFreeFirstInfluencer,
    }, { status: 201 })
  } catch (err) {
    console.error('[influencers] create failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
