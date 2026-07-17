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

export const INFLUENCER_CREATE_CR = 20   // Sonnet + NB Pro portrait + turnaround character sheet

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
- Hyper-realistic candid photograph: natural window light, real skin texture with pores and small imperfections, no beauty filter, no studio gloss
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
    }
    const hasTraits = !!(traits.gender || traits.ageRange || traits.styles.length || traits.hairColor || traits.eyeColor)
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
    if (!credits || credits.balance < INFLUENCER_CREATE_CR) {
      return NextResponse.json({ error: `Insufficient credits. Need ${INFLUENCER_CREATE_CR}.` }, { status: 402 })
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
    const traitsBlock = traitLines.length
      ? `\n\nLOCKED TRAITS — the client explicitly selected these; honor every one exactly in the identity sheet and appearance_prompt:\n${traitLines.join('\n')}`
      : ''
    userContent.push({
      type: 'text',
      text: (referenceImages.length
        ? `Client description of the influencer:\n${description || '(traits only)'}\n\nThe attached photo${referenceImages.length > 1 ? 's show' : ' shows'} the exact look the influencer should be based on — write the appearance_prompt to describe THIS person's face, hair, features, and style faithfully (adult, no age numbers).`
        : `Client description of the influencer:\n${description || '(traits only — build the character from the locked traits below)'}`) + traitsBlock,
    })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: IDENTITY_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
    })
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

    // 2) Nano Banana Pro renders the canonical portrait — with the client's
    // reference photos as identity anchors when provided.
    const portrait = await generateNanoBananaImage(sheet.appearance_prompt, {
      style: 'realistic',
      ratio: '4:5',
      referenceImages: referenceImages.length ? referenceImages : undefined,
      referenceHint: referenceImages.length
        ? 'The person in the attached reference photo(s) IS this character — preserve their exact face, hair, skin tone, and distinctive features. Apply the prompt as framing + lighting around them; do NOT invent a different person.'
        : undefined,
    })

    // 3) Upload portrait to storage.
    const filename = `influencers/${auth.userId}-${Date.now()}-portrait.png`
    const { error: upErr } = await supabase.storage
      .from('ugc-assets')
      .upload(filename, Buffer.from(portrait.imageBase64, 'base64'), { contentType: portrait.mimeType, upsert: false })
    if (upErr) throw new Error(`Portrait upload failed: ${upErr.message}`)
    const portraitUrl = supabase.storage.from('ugc-assets').getPublicUrl(filename).data.publicUrl

    // 4) Persist.
    const { data: influencer, error: insErr } = await supabase
      .from('user_influencers')
      .insert({
        user_id: auth.userId,
        name: String(sheet.name).slice(0, 80),
        handle: typeof sheet.handle === 'string' ? sheet.handle.slice(0, 40) : null,
        bio: typeof sheet.bio === 'string' ? sheet.bio.slice(0, 400) : null,
        personality: typeof sheet.personality === 'string' ? sheet.personality.slice(0, 600) : null,
        niche: typeof sheet.niche === 'string' ? sheet.niche.slice(0, 120) : null,
        appearance_prompt: String(sheet.appearance_prompt).slice(0, 2000),
        portrait_url: portraitUrl,
      })
      .select('*')
      .single()
    if (insErr) throw insErr

    // 4b) Character turnaround sheet — multi-angle grid used as the primary
    // identity anchor for photoshoots + UGC frames. Fail-soft: the
    // influencer is still usable with just the portrait.
    let sheetUrl: string | null = null
    try {
      sheetUrl = await generateCharacterSheet({
        supabase, userId: auth.userId,
        influencerId: influencer.id,
        appearancePrompt: influencer.appearance_prompt,
        portraitUrl,
      })
      influencer.character_sheet_url = sheetUrl
    } catch (sheetErr) {
      console.warn('[influencers] character sheet failed:', sheetErr instanceof Error ? sheetErr.message : sheetErr)
    }

    // 5) Charge.
    const { newBalance, newPackCredits } = await deductCredits(
      supabase, auth.userId, INFLUENCER_CREATE_CR, credits.balance, credits.pack_credits ?? 0,
    )
    await supabase.from('user_credits')
      .update({ balance: newBalance, pack_credits: newPackCredits })
      .eq('user_id', auth.userId)

    return NextResponse.json({ influencer, creditsCharged: INFLUENCER_CREATE_CR }, { status: 201 })
  } catch (err) {
    console.error('[influencers] create failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
