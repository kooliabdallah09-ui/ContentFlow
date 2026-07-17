// Photoshoot — generate photos of an influencer in a described scene.
//
// POST body: { scene, count? } — Nano Banana Pro runs image-to-image with
// the canonical portrait as the identity reference. Each photo costs
// PHOTOSHOOT_CR_PER_IMAGE. Up to 4 per call, generated in parallel.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateNanoBananaImage } from '@/lib/nanobanana'
import { deductCredits } from '@/lib/deduct-credits'
import { canAccessInfluencerStudio } from '@/lib/pov-access'

export const maxDuration = 120

export const PHOTOSHOOT_CR_PER_IMAGE = 8       // NB Pro w/ reference ≈ $0.15 → 1.8× markup
export const PHOTOSHOOT_NB2_CR_PER_IMAGE = 4   // Nano Banana 2 — cheaper, less faithful
export const PHOTOSHOOT_4K_CR_PER_IMAGE = 14   // NB Pro 4K: $0.24 raw × 1.4 markup ≈ 14 cr

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Per-shot variation so a 4-photo batch reads like a real shoot, not
// four near-identical renders.
const SHOT_VARIATIONS = [
  'Caught fully mid-action, eyes on their task (NOT the camera), body angled naturally into the activity, framed head to mid-thigh, subject placed off-center on a rule-of-thirds line.',
  'Documentary-style candid — mid-motion, reaching/handling/doing, looking at what their hands are doing, three-quarter body visible, environment filling the rest of the frame.',
  'One brief glance toward the camera mid-activity, like a friend called their name while they were busy — hands still engaged with the task, head-to-knees framing, slightly off-center.',
  'Wider environmental shot from behind or the side, subject head-to-toe but small-ish in the frame, absorbed in the activity, scene doing most of the talking.',
]

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

    const body = await request.json()
    const scene = String(body?.scene ?? '').trim().slice(0, 500)
    const count = Math.min(4, Math.max(1, Number(body?.count) || 1))
    const ratio: '9:16' | '16:9' | '1:1' | '4:5' =
      body?.ratio === '9:16' || body?.ratio === '16:9' || body?.ratio === '1:1' ? body.ratio : '4:5'
    // Quality: 'nb2' (budget) · 'pro' (default) · '4k' (NB Pro at 4K output).
    const quality: 'nb2' | 'pro' | '4k' = body?.quality === 'nb2' || body?.model === 'nb2' ? 'nb2'
      : body?.quality === '4k' ? '4k' : 'pro'
    const model: 'pro' | 'nb2' = quality === 'nb2' ? 'nb2' : 'pro'
    const crPerImage = quality === 'nb2' ? PHOTOSHOOT_NB2_CR_PER_IMAGE
      : quality === '4k' ? PHOTOSHOOT_4K_CR_PER_IMAGE : PHOTOSHOOT_CR_PER_IMAGE
    if (scene.length < 3) return NextResponse.json({ error: 'Describe the scene' }, { status: 400 })
    // Optional attachments: scene / outfit / prop reference photos the
    // shots should incorporate (e.g. a specific jacket, a product, a
    // location photo). Capped at 2 to stay under body-size limits.
    const sceneRefs: Array<{ base64: string; mimeType: string }> = Array.isArray(body?.sceneImages)
      ? body.sceneImages
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((r: any) => typeof r?.base64 === 'string' && r.base64.length > 100 && typeof r?.mimeType === 'string')
          .slice(0, 2)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((r: any) => ({ base64: r.base64, mimeType: r.mimeType }))
      : []

    const { data: influencer } = await supabase
      .from('user_influencers')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (!influencer) return NextResponse.json({ error: 'Influencer not found' }, { status: 404 })

    const totalCost = crPerImage * count
    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .maybeSingle()
    if (!credits || credits.balance < totalCost) {
      return NextResponse.json({ error: `Insufficient credits. Need ${totalCost}.` }, { status: 402 })
    }

    // Identity references: the multi-angle character sheet (when present)
    // is the primary anchor — it shows the face and body from every angle,
    // which keeps Nano Banana far more accurate than a single portrait.
    // The portrait rides along as a face close-up.
    const refUrls = [influencer.character_sheet_url, influencer.portrait_url].filter(
      (u): u is string => typeof u === 'string' && u.startsWith('http'),
    )
    const identityRefs = (await Promise.all(refUrls.map(async url => {
      try {
        const r = await fetch(url)
        if (!r.ok) return null
        return {
          base64: Buffer.from(await r.arrayBuffer()).toString('base64'),
          mimeType: r.headers.get('content-type') || 'image/png',
        }
      } catch { return null }
    }))).filter((x): x is { base64: string; mimeType: string } => !!x)
    if (!identityRefs.length) throw new Error('Could not load identity references')

    // Note: never say 'phone-camera photo' or 'selfie' — that phrasing primes
    // Nano Banana to render an iPhone camera UI overlay (shutter button,
    // controls) on top of the image. Describe the photographic QUALITIES
    // instead, and explicitly forbid interface elements.
    let refDescription = influencer.character_sheet_url
      ? 'The attached references show this exact character: a multi-angle turnaround sheet (full-body + head from every angle) and a face close-up. Every generated photo must be THIS person'
      : 'The person in the attached reference image IS this exact character'
    if (sceneRefs.length) {
      refDescription += `. The LAST ${sceneRefs.length} attached image${sceneRefs.length > 1 ? 's are' : ' is'} NOT the person — ${sceneRefs.length > 1 ? 'they show' : 'it shows'} a scene, outfit, or object the photo must incorporate faithfully (exact clothing/product/location as pictured)`
    }
    const basePrompt = (variation: string) =>
      `${influencer.appearance_prompt}\n\nScene: ${scene}\n${variation}\n\n${refDescription} — preserve their face, hair, skin tone, and identity precisely.

CANDID, NOT POSED — CRITICAL: the person is genuinely DOING the scene's activity (picking produce, lifting a weight, sipping the drink, walking) — hands physically engaged with real objects, weight mid-shift, eyes on their task. NO standing square to camera, NO posed smile at the lens, NO model energy — it should look like someone photographed them without warning. Only make eye contact with the camera if the scene text explicitly asks for it.

COMPOSITION: the subject does NOT have to be centered — use rule-of-thirds placement, let the environment breathe around them, allow foreground elements to partially overlap. OUTFIT IS NOT LOCKED: the clothing worn in the reference images is just what they had on that day — dress the character appropriately for THIS scene, and if the scene description mentions clothing or style, that wins over whatever the references show. FRAMING: never a tight head-and-shoulders crop — show the upper body AND part of the lower body (waist/hips/thighs), so their full outfit reads clearly, like a casual mirror or arm's-length social photo. Hyper-realistic candid snapshot: natural light appropriate to the scene, real skin texture with pores and small imperfections, natural face, no plastic face, no AI-smooth skin, believable social-media energy, no beauty filter. The look of a casual smartphone photo taken by a friend: bright even exposure, deep focus with the background nearly as sharp as the subject (NO shallow depth of field, NO bokeh), mild consumer-camera HDR, true-to-life neutral colors, slightly imperfect framing. NOT an editorial or fashion photoshoot: no cinematic color grade, no dramatic rim lighting, no posed model energy, no magazine retouching.\n\nThe output is the photograph itself, full-bleed. Absolutely NO camera interface elements: no shutter button, no camera controls, no viewfinder overlay, no on-screen text, no status bar, no app UI, no watermark, no borders.`

    const results = await Promise.allSettled(
      Array.from({ length: count }, (_, i) =>
        generateNanoBananaImage(basePrompt(SHOT_VARIATIONS[i % SHOT_VARIATIONS.length]), {
          style: 'realistic',
          ratio,
          model,
          resolution: quality === '4k' ? '4K' : undefined,
          referenceImages: [...identityRefs, ...sceneRefs],
          referenceHint: sceneRefs.length
            ? 'The FIRST reference image(s) define this exact person — face, hair, skin tone, build ONLY; their clothing may change per the prompt. The LAST image(s) show a scene/outfit/object to incorporate faithfully. Apply the prompt as framing around them.'
            : 'The attached reference images define this exact person — face, hair, skin tone, build ONLY; their clothing may change per the prompt. Apply the prompt as scene + framing around them.',
        }),
      ),
    )

    const photos: Array<{ id: string; scene: string; image_url: string; created_at: string }> = []
    for (const r of results) {
      if (r.status !== 'fulfilled') continue
      const filename = `influencers/${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-shoot.png`
      const { error: upErr } = await supabase.storage
        .from('ugc-assets')
        .upload(filename, Buffer.from(r.value.imageBase64, 'base64'), { contentType: r.value.mimeType, upsert: false })
      if (upErr) continue
      const url = supabase.storage.from('ugc-assets').getPublicUrl(filename).data.publicUrl
      const { data: row } = await supabase
        .from('user_influencer_photos')
        .insert({ influencer_id: id, user_id: userId, scene, image_url: url })
        .select('id, scene, image_url, created_at')
        .single()
      if (row) photos.push(row)
    }
    if (!photos.length) {
      return NextResponse.json({ error: 'All photo generations failed, try a different scene' }, { status: 500 })
    }

    // Charge only for the photos that succeeded.
    const charged = crPerImage * photos.length
    const { newBalance, newPackCredits } = await deductCredits(
      supabase, userId, charged, credits.balance, credits.pack_credits ?? 0,
    )
    await supabase.from('user_credits')
      .update({ balance: newBalance, pack_credits: newPackCredits })
      .eq('user_id', userId)
    await supabase.from('user_influencers')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ photos, creditsCharged: charged })
  } catch (err) {
    console.error('[influencers/photoshoot] failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
