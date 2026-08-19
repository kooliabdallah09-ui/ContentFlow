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

appearance_prompt rules — write a prompt that produces a STUNNING, HIGHLY ATTRACTIVE portrait:

PERSON & FACE — this is the most important section:
- AGE: This person is in their EARLY-TO-MID 20S — fresh-faced, unlined skin with zero wrinkles or sun damage, plump youthful cheeks, bright eyes with no heaviness or under-eye shadow. Think university-age energy. The skin must look genuinely young — not mature or weathered. NO fine lines, NO crow's feet, NO sun spots, NO forehead lines. This is the #1 thing to get right.
- This person has a STRIKING, MODEL-TIER face — the kind of face that stops scrolling on Instagram. Describe in detail:
  - Face shape (oval, heart-shaped, or sculpted angular)
  - Cheekbones: naturally present and softly defined — not overpowering, not flat. The kind of face structure that photographs beautifully without looking angular or gaunt. Balanced and feminine/handsome, not dramatically sculpted.
  - Jawline: CLEAN and DEFINED — not soft, not round, but sculpted
  - Eyes: describe the EXACT shape (almond, slightly upturned, hooded with depth, wide-set doe eyes), color with warmth (e.g. "warm honey-brown with golden flecks", "deep olive-green", "dark espresso with a natural gleam"), and lashes (naturally long and lifted)
  - Lips: FULL with a pronounced cupid's bow — naturally pigmented in a soft rose or nude-pink. Plump and youthful.
  - Nose: straight or slightly softly curved — proportional and refined
  - Skin: SMOOTH, PLUMP, YOUTHFUL — the unlined radiant skin of someone in their early 20s. No texture that reads as age. Clean and glowing.
- Ethnicity/cultural background: be specific (e.g. Latina, Mediterranean, East Asian, South Asian, Mixed) — this drives a specific beautiful face
- For any trait NOT specified, make the most attractive creative choice — never leave gaps

HAIR:
- Voluminous, full of movement. For females: long wavy or beachy layers, glossy with depth — not limp or flat. For males: textured and effortlessly styled. Describe: color with dimension (rich chocolate brown with warm auburn, dark walnut with caramel highlights, warm blonde with honey tones), length, and movement.

SKIN & MAKEUP — choose ONE of these two looks based on the vibe:
- "Natural / no makeup" look (use when client says raw, real, minimal, no makeup, or car/street vibe): bare skin with natural texture — visible pores, healthy real skin with slight natural variation. No makeup at all. Brows naturally shaped, lips their natural color. Skin tone is even and healthy but not filtered. This look is often MORE striking than the made-up version. Use it for candid, authentic, raw aesthetics.
- "Effortless polish" look (use for bedroom, lifestyle, golden-hour settings): clean dewy base, naturally defined brows, lifted lashes, faint peachy flush, soft nude-rose lip. Still light — not glamour, not overdone.
- Male: clear even skin, light to medium stubble, groomed brows, natural texture.

CAMERA ANGLE & POSE:
- Camera at eye level or just barely below — NOT shooting steeply upward. A slight upward angle is enough to subtly define the jawline. Overdoing this makes people look worse.
- Head turned just slightly to the side — a gentle 3/4 turn, not a full tilt. Eyes can look toward camera or just slightly off it. Natural, relaxed, candid.
- Framing: shoulders-up or tight on the face (face filling most of the frame). Both work.

FRAMING & SETTING:
- Setting: bright airy bedroom, sun-lit kitchen, soft outdoor light, or car interior with side window light. Pick what fits the vibe.
- Light: soft, even, natural daylight from one side — gentle highlights on cheekbones and nose, no harsh shadows. Warm golden morning light OR soft overcast window light. Never ring light or studio.
- Outfit: casual and flattering — crop top, off-shoulder ribbed top, fitted tee, crewneck, open cardigan.

SKIN & MAKEUP:
- Skin is healthy, clean, and even-toned with a natural soft glow — not matte, not flat, but also NOT heavily dewy or glowing like a filter. Barely-there natural skin texture — the kind of skin a beautiful person actually has. No heavy airbrushing, no excessive redness, no dramatic pores, no rough texture. Just clean healthy human skin.
- Makeup: minimal and natural — defined lashes, groomed brows, soft nude or rose lip. Light, effortless. Not heavy, not bare.
- Hyper-realistic smartphone photo — natural depth, true-to-life color, slight grain. Looks like a real candid from an attractive person's camera roll.
- The prompt must end with: 'Full-bleed photograph only — no camera interface, no shutter button, no viewfinder overlay, no on-screen text, no app UI, no watermark.'
- NEVER use the words 'phone camera', 'selfie', or 'screenshot'
- NEVER include age numbers, brand names, or the words 'young' or 'girl'
- Honor every physical trait the client explicitly asked for
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

The appearance_prompt must be one continuous string written in 4 dense paragraphs (no labels or headers, just paragraphs separated by newlines). The goal is a STUNNING, STOP-THE-SCROLL portrait of a highly attractive person:

First paragraph: Ultra-realistic vertical smartphone photo of a strikingly beautiful [specific cultural background, e.g. "Latina", "Mediterranean", "East Asian", "South Asian"] [gender]. Face: [be very specific — e.g. "sharply defined high cheekbones that cast a subtle natural shadow, a clean sculpted jawline, near-symmetrical oval face, full lips with a pronounced cupid's bow and natural rose-nude pigment, warm almond-shaped honey-brown eyes with naturally long lifted lashes and a faint inner-eye highlight, a straight refined nose"]. [Voluminous hair: e.g. "Long rich chocolate-brown wavy hair with warm auburn depth in sunlight, voluminous and full with soft natural waves and a few strands brushing her collarbone — not flat, full of movement and gloss"]. [Skin: e.g. "Warm olive skin with a luminous golden-hour glow — dewy and radiant, lit from within, not filtered or matte"]. Wearing [specific flattering outfit].

Second paragraph: [Expression: e.g. "Looking directly into the camera with soft direct eye contact and a relaxed natural half-smile — warm and approachable without being posed. Lips slightly parted, completely at ease"]. The energy is that of a creator who just hit record mid-morning and looks effortlessly good. [One specific beautiful detail: e.g. "Her collarbone is visible, hair has a natural wave and volume that frames her face perfectly"].

Third paragraph: [Lifestyle setting in detail: e.g. "Bright airy bedroom — white textured linen duvet, warm natural wood headboard, morning light pouring through sheer white curtains creating a soft warm glow across the room. A small plant on the nightstand, a glass of water. Clean and aspirational but lived-in"]. The light is warm and directional, casting soft shadows that are flattering to the face.

Fourth paragraph: Shot on a smartphone camera at eye level or barely below, subject's head turned just slightly to the side with a natural relaxed expression. [Crop: face filling the frame, or shoulders-up]. Soft even natural daylight from a side window — gentle highlights on cheekbones and nose, no harsh shadows, no ring light. Skin looks healthy, clean, and naturally even — subtle texture, not airbrushed but not rough. Minimal natural makeup: defined lashes, groomed brows, soft lip. Natural grain, true-to-life color, realistic phone lens perspective. Candid and real — indistinguishable from a photo taken in the moment. 9:16 aspect ratio.

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
    const { sanitizeUserPrompt } = await import('@/lib/sanitize-prompt')
    const sanitized = sanitizeUserPrompt(String(body?.description ?? '').trim().slice(0, 1500))
    if (sanitized.flagged.length) {
      console.log(`[influencers] prompt injection blocked (${sanitized.flagged.join(',')}) for user ${auth.userId}`)
    }
    const description = sanitized.clean
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

    // First influencer is always free — count only user-created rows, not the
    // seeded default (Sloane Mercer). is_seed=true is set by the signup route.
    const { count: existingCount } = await supabase
      .from('user_influencers')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.userId)
      .or('is_seed.is.null,is_seed.eq.false')
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

    // Moderate user-uploaded reference portraits before we spend compute.
    // Fail-open on API errors (see lib/moderate-portrait.ts) so a moderation
    // outage doesn't block legit creators.
    if (referenceImages.length) {
      const { moderatePortrait } = await import('@/lib/moderate-portrait')
      for (const img of referenceImages) {
        const verdict = await moderatePortrait(img)
        if (!verdict.allow) {
          const friendly: Record<string, string> = {
            celebrity: 'One of the reference photos looks like a recognisable public figure. Please use original photos or generic reference material only.',
            minor: 'One of the reference photos looks like it may show a minor. We only accept adult (18+) subjects.',
            nsfw: 'One of the reference photos was flagged as explicit content. Please upload a different image.',
            'not-human': 'One of the reference photos doesn\'t appear to show a human portrait. Please upload a clear headshot.',
          }
          return NextResponse.json({
            error: friendly[verdict.reason ?? 'not-human'] ?? 'One of the reference photos was rejected by content moderation.',
            moderationReason: verdict.reason,
          }, { status: 400 })
        }
      }
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
