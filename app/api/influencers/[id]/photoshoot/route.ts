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

export const PHOTOSHOOT_CR_PER_IMAGE = 8   // NB Pro w/ reference ≈ $0.15 → 1.8× markup

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Per-shot variation so a 4-photo batch reads like a real shoot, not
// four near-identical renders.
const SHOT_VARIATIONS = [
  'Three-quarter shot framed from head to mid-thigh, subject looking at the camera with a relaxed smile, one arm naturally extended or resting.',
  'Candid three-quarter moment — subject mid-laugh or looking slightly off-camera, caught naturally, framed head to mid-thigh.',
  'Three-quarter framing head to mid-thigh, golden warm tones, soft depth of field behind the subject.',
  'Wider environmental shot showing the subject from head to knees with the location visible around them.',
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

    const totalCost = PHOTOSHOOT_CR_PER_IMAGE * count
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
      `${influencer.appearance_prompt}\n\nScene: ${scene}\n${variation}\n\n${refDescription} — preserve their face, hair, and identity precisely. FRAMING: never a tight head-and-shoulders crop — show the upper body AND part of the lower body (waist/hips/thighs), so their full outfit reads clearly, like a casual mirror or arm's-length social photo. Hyper-realistic candid photograph: natural light appropriate to the scene, real skin texture with pores and small imperfections, slight handheld softness, believable social-media energy, no beauty filter.\n\nThe output is the photograph itself, full-bleed. Absolutely NO camera interface elements: no shutter button, no camera controls, no viewfinder overlay, no on-screen text, no status bar, no app UI, no watermark, no borders.`

    const results = await Promise.allSettled(
      Array.from({ length: count }, (_, i) =>
        generateNanoBananaImage(basePrompt(SHOT_VARIATIONS[i % SHOT_VARIATIONS.length]), {
          style: 'realistic',
          ratio: '4:5',
          referenceImages: [...identityRefs, ...sceneRefs],
          referenceHint: sceneRefs.length
            ? 'The FIRST reference image(s) define this exact person — same face, hair, skin tone, build. The LAST image(s) show a scene/outfit/object to incorporate faithfully. Apply the prompt as framing around them.'
            : 'The attached reference images define this exact person — same face, hair, skin tone, build in the output. Apply the prompt as scene + framing around them.',
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
    const charged = PHOTOSHOOT_CR_PER_IMAGE * photos.length
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
