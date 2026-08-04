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

export const maxDuration = 300

export const PHOTOSHOOT_CR_PER_IMAGE = 8       // NB Pro w/ reference ≈ $0.15 raw × 1.4
export const PHOTOSHOOT_NB2_CR_PER_IMAGE = 4   // Nano Banana 2 — cheaper, less faithful
export const PHOTOSHOOT_4K_CR_PER_IMAGE = 14   // NB Pro 4K: $0.24 raw × 1.4 markup ≈ 14 cr

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Per-shot FRAMING variation — pure camera/composition tweaks so a 4-photo
// batch has visual variety, WITHOUT overriding what the user actually asked
// for. Previous version dictated activity ("eyes on task NOT camera, mid-
// action, hands doing something") which forced fake activities when the
// user typed "a selfie" or "a portrait".
const SHOT_VARIATIONS = [
  'Framing: chest-up crop, subject slightly off-centre.',
  'Framing: three-quarter body (head to mid-thigh), rule-of-thirds composition.',
  'Framing: wider environmental crop, subject full-body, scene visible around them.',
  'Framing: tighter medium shot, head-to-waist, softly off-centre.',
]

// The user's scene text sometimes explicitly asks for a portrait / selfie /
// headshot. In those cases we DON'T want the "candid mid-action, eyes on
// task" default — the user wants a posed camera-facing shot.
function isSelfieIntent(scene: string): boolean {
  const s = scene.toLowerCase()
  return /(^|\s)(a\s+)?(selfie|portrait|headshot|close-?up|mirror shot|profile shot|posed shot|looking (at|into) (the )?camera)(\s|$|,|\.)/.test(s)
}

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
    const studioProductId = typeof body?.studioProductId === 'string' && body.studioProductId.length > 0 ? body.studioProductId : null
    const sceneId = typeof body?.sceneId === 'string' && body.sceneId.length > 0 ? body.sceneId : null
    // Guest influencers co-star with the primary influencer in the same shot.
    const guestIdsRaw: unknown = body?.guestInfluencerIds
    const guestInfluencerIds: string[] = Array.isArray(guestIdsRaw)
      ? [...new Set(guestIdsRaw.filter((v): v is string => typeof v === 'string' && v.length > 0 && v !== id))].slice(0, 3)
      : []
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

    // Optional Product Studio product — the influencer uses/wears it in
    // the shots; its angle photos become packaging-fidelity refs.
    let studioProduct: { name: string; category?: string | null } | null = null
    let productRefs: Array<{ base64: string; mimeType: string }> = []
    if (studioProductId) {
      const { data: prod } = await supabase
        .from('user_studio_products')
        .select('name, category, photo_urls')
        .eq('id', studioProductId)
        .eq('user_id', userId)
        .maybeSingle()
      if (prod) {
        studioProduct = { name: prod.name, category: prod.category }
        const urls: string[] = Array.isArray(prod.photo_urls) ? prod.photo_urls.slice(0, 2) : []
        productRefs = (await Promise.all(urls.map(async (u: string) => {
          try {
            const r = await fetch(u)
            if (!r.ok) return null
            return { base64: Buffer.from(await r.arrayBuffer()).toString('base64'), mimeType: r.headers.get('content-type') || 'image/png' }
          } catch { return null }
        }))).filter((x): x is { base64: string; mimeType: string } => !!x)
      }
    }

    const totalCost = crPerImage * count
    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .maybeSingle()
    if (!credits || credits.balance < totalCost) {
      return NextResponse.json({ error: `Insufficient credits. Need ${totalCost}.` }, { status: 402 })
    }

    // Identity references — order by identity fidelity strength:
    //   1. User's ORIGINAL uploaded photos (up to 3) — the ground truth. NB
    //      Pro treats the first image as the strongest anchor, so putting
    //      real photos here prevents cumulative AI drift over time.
    //   2. Multi-angle character sheet — the AI turnaround, useful for
    //      body/wardrobe consistency even if faces have drifted slightly.
    //   3. Portrait — face close-up backup.
    const originalRefs: string[] = Array.isArray(influencer.reference_urls)
      ? (influencer.reference_urls as string[]).filter(u => typeof u === 'string' && u.startsWith('http')).slice(0, 3)
      : []
    const refUrls = [
      ...originalRefs,
      influencer.character_sheet_url,
      influencer.portrait_url,
    ].filter((u): u is string => typeof u === 'string' && u.startsWith('http'))
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

    // Guest influencer identity refs — one image per guest (portrait preferred,
    // character sheet as fallback) so we don't blow the NB reference budget.
    let guestDetails: Array<{ name: string; appearance_prompt: string; ref: { base64: string; mimeType: string } }> = []
    if (guestInfluencerIds.length) {
      const { data: gs } = await supabase
        .from('user_influencers')
        .select('id, name, appearance_prompt, portrait_url, character_sheet_url')
        .in('id', guestInfluencerIds)
        .eq('user_id', userId)
      const byId = new Map((gs ?? []).map(r => [String(r.id), r]))
      const ordered = guestInfluencerIds.map(gid => byId.get(gid)).filter((x): x is { id: string; name: string; appearance_prompt: string; portrait_url: string; character_sheet_url: string | null } => !!x)
      const loaded = await Promise.all(ordered.map(async g => {
        const url = g.portrait_url && g.portrait_url.startsWith('http') ? g.portrait_url
          : (g.character_sheet_url && g.character_sheet_url.startsWith('http') ? g.character_sheet_url : null)
        if (!url) return null
        try {
          const r = await fetch(url)
          if (!r.ok) return null
          return {
            name: g.name,
            appearance_prompt: g.appearance_prompt,
            ref: { base64: Buffer.from(await r.arrayBuffer()).toString('base64'), mimeType: r.headers.get('content-type') || 'image/png' },
          }
        } catch { return null }
      }))
      guestDetails = loaded.filter((x): x is { name: string; appearance_prompt: string; ref: { base64: string; mimeType: string } } => !!x)
    }
    const guestRefs: Array<{ base64: string; mimeType: string }> = guestDetails.map(g => g.ref)

    // Optional Scene — a reusable environment the user built in Scene Studio.
    // We fetch the hero (empty-scene render) and pass it as a location
    // reference to NB. Its scene_prompt is also appended so Sonnet + NB
    // know exactly which place they're populating.
    let sceneDetail: { name: string; scene_prompt: string } | null = null
    let sceneRef: { base64: string; mimeType: string } | null = null
    if (sceneId) {
      const { data: sceneRow } = await supabase
        .from('user_scenes')
        .select('id, name, scene_prompt, hero_image_url, reference_urls')
        .eq('id', sceneId)
        .eq('user_id', userId)
        .maybeSingle()
      if (sceneRow) {
        sceneDetail = { name: sceneRow.name, scene_prompt: sceneRow.scene_prompt }
        // Prefer the user's original references if we have them (drift-free
        // anchor to the real place), otherwise the hero render.
        const originalRefs: string[] = Array.isArray(sceneRow.reference_urls)
          ? (sceneRow.reference_urls as string[]).filter(u => typeof u === 'string' && u.startsWith('http'))
          : []
        const anchorUrl = originalRefs[0] ?? sceneRow.hero_image_url
        if (anchorUrl && typeof anchorUrl === 'string' && anchorUrl.startsWith('http')) {
          try {
            const r = await fetch(anchorUrl)
            if (r.ok) {
              sceneRef = {
                base64: Buffer.from(await r.arrayBuffer()).toString('base64'),
                mimeType: r.headers.get('content-type') || 'image/png',
              }
            }
          } catch { /* soft fail — prompt still describes the scene */ }
        }
        // Bump last_used_at so the picker sorts recently-used scenes to top.
        void supabase.from('user_scenes').update({ last_used_at: new Date().toISOString() }).eq('id', sceneId).eq('user_id', userId)
      }
    }

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
    const wearable = studioProduct && (studioProduct.category === 'apparel' || studioProduct.category === 'footwear')
    // Total people in the shot for pronoun agreement in the product clauses.
    const totalPeople = 1 + guestDetails.length
    const pronounSubj = totalPeople > 1 ? 'EVERY person in the shot' : 'The person'
    const productLine = studioProduct
      ? (wearable
          // Heavier wearable clause: name the garment explicitly, force it as
          // the ONLY visible top layer, and pre-empt any competing outfit
          // description from the identity block or reference photos. When
          // co-stars are in the shot, they must ALSO wear the same product.
          ? `\n★ WEARING THE PRODUCT — non-negotiable, top priority ★
${pronounSubj} is WEARING the "${studioProduct.name}" garment (shown in the product reference image) as their OUTFIT / TOP LAYER in this photograph. This exact garment — its colour, cut, print, label and design — replaces any other top or jacket ${totalPeople > 1 ? 'anyone in the shot might normally wear' : 'the person might normally wear or be described as wearing'}. ${totalPeople > 1 ? 'ALL of them are wearing THE SAME product on their torso — same colour, same print, same design (varying only sizing to fit each body). Not one wearing it and the rest in different tops — that fails the shoot.' : ''} Do NOT layer another jacket, hoodie, coat or top over it. Do NOT invent a different shirt. If the reference identity photo shows them in a different top, IGNORE that top entirely; it is not part of this shoot.`
          : `\nTHE PRODUCT — HIGHEST PRIORITY: ${pronounSubj} ${totalPeople > 1 ? 'are' : 'is'} naturally using/holding "${studioProduct.name}" (the exact item from the product reference images) in this scene — hands engaged with it as part of the activity, product undistorted, clearly visible, packaging exact. ${totalPeople > 1 ? 'Each person has their own copy of the product (identical packaging, identical labels) — a shared moment where everyone has one.' : ''}`)
      : ''
    const guestLine = guestDetails.length
      ? `\n★ ${guestDetails.length === 1 ? 'A CO-STAR' : `${guestDetails.length} CO-STARS`} IN THE SAME SHOT — non-negotiable ★ ${guestDetails.length === 1 ? 'A second person' : `${guestDetails.length} additional people`} share the frame with the primary subject. They interact naturally — walking together, mid-conversation, laughing, cheersing, one handing off to the other, arms around each other. It must feel like a real duo/trio, not solo portraits pasted together. ${guestDetails.map((g, i) => `Co-star ${i + 1} (identity anchor images at positions ${identityRefs.length + i + 1}): ${g.appearance_prompt.slice(0, 400)}`).join(' ')} All faces must be fully visible — never crop a head, never let the product or the primary subject cover a co-star's face.`
      : ''
    // Merge Scene Studio prompt with the user's freeform scene textarea. The
    // Scene sets the environment brief; the textarea layers the action ("she
    // walks past a jukebox mid-sip") on top.
    const composedScene = sceneDetail
      ? `${sceneDetail.name} — ${sceneDetail.scene_prompt}${scene ? ` The specific moment / action within this scene: ${scene}` : ''}`
      : scene
    const sceneRefLine = sceneRef
      ? `\n★ SCENE ANCHOR IMAGE — the LAST attached image is the EXACT environment (${sceneDetail?.name ?? 'this place'}). The photograph must render inside this same location, matching its architecture, materials, decor, and palette faithfully. CRITICAL: the LIGHTING VISIBLE IN THAT SCENE ANCHOR must be the SAME lighting hitting the ${totalPeople > 1 ? 'people' : 'person'} in the final photograph — same colour temperature (warm amber if the scene is sunset, cool if the scene is overcast), same direction (from wherever the sun / string lights / lamps / window sit in the anchor), same intensity and contrast. Do NOT render the ${totalPeople > 1 ? 'people' : 'person'} in generic daylight while the anchor shows sunset / neon / dim interior. Never invent a different location and never invent different lighting than the anchor shows.`
      : ''
    // If the user asked for a selfie/portrait/headshot, respect that instead
    // of forcing the "candid mid-action, don't look at camera" default.
    const selfieMode = isSelfieIntent(scene)
    const performanceClause = selfieMode
      ? `SELFIE / PORTRAIT — the user explicitly asked for this. The person is facing the camera, phone at arm's length (front-camera framing), looking directly at the lens with a natural expression. Selfie framing is chest-up or head-and-shoulders. Their arm holding the phone can be visible at the frame edge — this is a REAL selfie, not a candid documentary shot. Ignore any "candid mid-action" defaults for this render.`
      : `CANDID, NOT POSED — the person is genuinely DOING the scene's activity — hands physically engaged with real objects, eyes on their task, walking / mid-motion. NO standing square to camera, NO posed smile at the lens, NO model energy. Only make eye contact with the camera if the scene text explicitly asks for it.`
    const compositionClause = selfieMode
      ? `COMPOSITION: front-camera selfie framing — chest-up or head-and-shoulders. Subject centered or slightly off-centre. Their outfit reads clearly at the top. The phone / hand may be visible at the corner of the frame.`
      : `COMPOSITION: subject placed by rule-of-thirds — NOT centered. Show the upper body AND part of the lower body (waist/hips/thighs) so their full outfit reads clearly. NEVER a tight head-and-shoulders crop.`
    const basePrompt = (variation: string) =>
      // Order matters: SCENE + PRODUCT go first so the model treats them as
      // the primary subject; identity + camera hints come after as constraints.
      `SCENE — this is the whole photograph, do not substitute: ${composedScene}. ${selfieMode ? '' : variation}${sceneRefLine}
${productLine}${guestLine}

WHO — extract ONLY identity from the description below (face, hair, skin, build, features). IGNORE any location, background, environment, time of day, or lighting mentioned here — those describe how the reference portrait was originally shot and DO NOT belong in this photo. The SCENE above is the entire environment:
${influencer.appearance_prompt}

${refDescription} — preserve their face, hair, skin tone, and identity precisely.${guestDetails.length ? ` The co-star identity reference${guestDetails.length > 1 ? 's are' : ' is'} the next ${guestDetails.length} attached image${guestDetails.length > 1 ? 's' : ''} — match each co-star's face to their reference exactly, all faces fully visible.` : ''}

${performanceClause}

${compositionClause}

LIGHTING & LOOK — this is the #1 way a shot reads as REAL vs AI composite. The light HITTING THE ${totalPeople > 1 ? 'PEOPLE' : 'PERSON'} in the shot MUST come from the SCENE above, not from generic daylight:
  - Colour temperature of the skin, hair, and clothing MUST match the scene's ambient (warm terracotta sunset → warm amber cast on skin + hair rim-lit gold + shadows on the cool side; neon night street → colour-spilled magenta/cyan rim on skin + saturated shadows; cool overcast interior → flat cool ambient on skin).
  - Direction of light must match the scene (visible sun / lamp / string lights / window direction → shadows fall the OPPOSITE way on the ${totalPeople > 1 ? 'people' : 'person'}, catchlights in the eyes come from that direction, hair has a rim where the light source is).
  - Intensity + contrast on the ${totalPeople > 1 ? 'people' : 'person'} match the scene's own contrast (a golden-hour scene = high-warmth low-contrast on skin; a fluorescent office = high-contrast cool ambient; a dim café = warm low-key with practical lamps).
  - NEVER render the ${totalPeople > 1 ? 'people' : 'person'} in generic sunny midday daylight while the scene shows sunset / night / dim interior — that reads instantly as an AI composite and fails the shoot.
Hyper-realistic candid smartphone photograph. REAL, individual attractive person — clear healthy even-toned skin with a natural subtle glow, LIGHT natural makeup (mascara, subtle blush, tinted lip). Barely-there real-skin micro-texture only. Do NOT add moles, freckle clusters, or red patches on the nose/cheeks/ears — those read as tacked-on AI imperfections and look worse than smooth skin. Individuality comes from bone structure and slight bone-level asymmetries (one eyebrow slightly arched, distinctive nose shape, defined cheekbones) — NOT from blemishes. Also NOT the plastic dead-symmetrical AI-influencer face. Aim for a genuinely attractive person who could book real modelling work — polished but human. NO shallow depth of field, NO editorial bokeh, NO magazine retouching, NO cinematic colour grade beyond what the scene naturally has.

★ INTEGRATION CHECK — before finalizing: does the person's lighting genuinely match the scene's lighting? If the scene is sunset, are they lit with warm amber from the same direction as the sun in the anchor? If the scene is a bright rooftop with string lights overhead, are those string lights casting warm dots of light on their hair + shoulders? If the answer is "no, they look pasted in with different light," DO IT OVER. Composite mismatch is the #1 tell that this is AI.

The output is the photograph itself, full-bleed. Absolutely NO camera interface elements, no shutter button, no viewfinder overlay, no on-screen text, no status bar, no app UI, no watermark, no borders.`

    // NB2 handles few reference images — with the full set (12-panel sheet
    // + portrait + product angles) it ignored the product entirely. On NB2,
    // slim to portrait + first product angle. Pro keeps everything.
    let effIdentityRefs = identityRefs
    let effProductRefs = productRefs
    if (model === 'nb2' && productRefs.length) {
      effIdentityRefs = identityRefs.slice(-1)   // portrait (last pushed) over the sheet
      effProductRefs = productRefs.slice(0, 1)
    }

    const generateBatch = (indices: number[]) =>
      Promise.allSettled(
        indices.map(i =>
          generateNanoBananaImage(basePrompt(SHOT_VARIATIONS[i % SHOT_VARIATIONS.length]), {
            style: 'realistic',
            ratio,
            model,
            resolution: quality === '4k' ? '4K' : undefined,
            referenceImages: [...effIdentityRefs, ...guestRefs, ...effProductRefs, ...sceneRefs, ...(sceneRef ? [sceneRef] : [])],
            referenceHint: (effProductRefs.length || sceneRefs.length)
              ? `The FIRST ${effIdentityRefs.length} reference image(s) define this exact person — face, hair, skin tone, build ONLY; whatever top / shirt / jacket they wear in those reference photos is IRRELEVANT and must NOT appear in the output.${effProductRefs.length ? ` The next ${effProductRefs.length} image(s) show the EXACT product${wearable ? ` — the person is WEARING this exact garment as their outfit's top layer in the output, with print, label text and colours reproduced exactly; do NOT layer any other jacket/hoodie/coat over it and do NOT substitute a different top` : ' — preserve its packaging/print, label text, colours, shape and proportions perfectly'}; never redesign it.` : ''}${sceneRefs.length ? ' The LAST image(s) show a scene/outfit/object to incorporate faithfully.' : ''} Apply the prompt as framing around them.`
              : 'The attached reference images define this exact person — face, hair, skin tone, build ONLY; their clothing may change per the prompt. Apply the prompt as scene + framing around them.',
          }),
        ),
      )

    const saveResults = async (results: PromiseSettledResult<{ imageBase64: string; mimeType: string }>[]) => {
      const saved: Array<{ id: string; scene: string; image_url: string; created_at: string }> = []
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
        if (row) saved.push(row)
      }
      return saved
    }

    const firstResults = await generateBatch(Array.from({ length: count }, (_, i) => i))
    const photos = await saveResults(firstResults)

    // Backfill any that failed — one retry pass for the missing count.
    const missing = count - photos.length
    if (missing > 0) {
      const backfillResults = await generateBatch(
        Array.from({ length: missing }, (_, i) => count + i),
      )
      const backfilled = await saveResults(backfillResults)
      photos.push(...backfilled)
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

    const stillMissing = count - photos.length
    return NextResponse.json({ photos, creditsCharged: charged, failed: stillMissing })
  } catch (err) {
    console.error('[influencers/photoshoot] failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
