import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { generateCharacterWithProduct, generateTextToImage, generateNanoBananaImage } from '@/lib/nanobanana'
import type { CharacterProfile } from '@/lib/character'
import { buildCharacterPrompt as buildCharacterImagePrompt, shotDirectionFor, SHOT_DIRECTIONS, websiteProductDirection } from '@/lib/ugc-character-prompt'
import { inferProductCategory } from '@/lib/multi-shot'
import { getCampaignFormat } from '@/lib/campaign-formats'

// Vercel Fluid Compute ceiling — Nano Banana Pro character generation
// occasionally spikes over 180s under load. 300s is the platform max.
export const maxDuration = 300

// UGC pipeline — phase A. Generates 4 hero-frame options with Nano Banana in
// parallel, uploads them all, returns their public URLs so the client can show
// the user a picker. No credits deducted here — the video-only cost is charged
// later at /api/ugc/animate against the frame the user chose.
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
    const {
      productName,
      productDescription,
      productImageBase64,
      productImageMimeType,
      character: characterFromForm,
      aspectId,
      customInstructions,   // freeform "video direction" (unbox / clean ad / morning routine)
      videoDirection,       // alias
      savedActorId,         // uuid of a user_saved_actors row — skips Haiku/Sonnet
      influencerId,         // uuid of a user_influencers row — pull gallery refs
      influencerPhotoUrl,   // user explicitly chose this gallery photo as the identity ref
      sceneId,              // uuid of a user_scenes row — override the location with a stored scene
      extraProductImages,   // additional photos of the SAME product (package + contents…)
      productPhotoAngles,   // parallel to [primary, ...extras] — angle labels so NB knows which UI screen each ref shows
      formatKey,            // campaign format key — drives shot-type-aware first frame
      productType,          // 'physical' | 'website' — website = the product image is a landing-page screenshot
    } = body as Record<string, unknown>

    const safeFormatKey = typeof formatKey === 'string' && formatKey.length > 0 ? formatKey : undefined
    const safeProductType: 'physical' | 'website' = productType === 'website' ? 'website' : 'physical'
    const campaignFormat = safeFormatKey ? getCampaignFormat(safeFormatKey) : undefined

    // Angles parallel to [primary, ...extras]. Used to label each reference
    // in the Nano Banana hint so the model knows which UI screen (landing
    // page / mobile view / dashboard / custom) each image shows.
    const angles: string[] = Array.isArray(productPhotoAngles)
      ? (productPhotoAngles as unknown[]).map(a => typeof a === 'string' ? a.trim() : '')
      : []
    const primaryAngle = angles[0] ?? ''
    const extraAngles = angles.slice(1)

    const extraProductRefs: Array<{ base64: string; mimeType: string }> = Array.isArray(extraProductImages)
      ? extraProductImages
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((r: any) => typeof r?.base64 === 'string' && r.base64.length > 100 && typeof r?.mimeType === 'string')
          .slice(0, 2)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((r: any) => ({ base64: r.base64, mimeType: r.mimeType }))
      : []

    // Resolve aspect for output dimensions.
    const { getAspect } = await import('@/lib/aspects')
    const aspect = getAspect(typeof aspectId === 'string' ? aspectId : undefined)

    const safeProductName = String(productName || 'the topic').trim() || 'the topic'
    const safeProductDescription = String(productDescription || '').trim()
    const safeVideoDirection = typeof videoDirection === 'string'
      ? videoDirection.slice(0, 500).trim()
      : (typeof customInstructions === 'string' ? customInstructions.slice(0, 500).trim() : '')

    const hasProduct = !!(productImageBase64 && productImageMimeType)
    const customPersona = characterFromForm as CharacterProfile | undefined

    // If the user picked a saved actor, load its stored image prompt and
    // use it verbatim — that's what keeps the character identical across
    // sessions. Otherwise run the Haiku + Sonnet chain from scratch.
    let characterIdea: string
    let imagePrompt: string
    if (typeof savedActorId === 'string' && savedActorId.length > 0) {
      const { data: saved, error: savedErr } = await supabase
        .from('user_saved_actors')
        .select('character_idea, character_image_prompt')
        .eq('id', savedActorId)
        .eq('user_id', userId)
        .maybeSingle()
      if (savedErr || !saved) {
        return NextResponse.json({ error: 'Saved actor not found' }, { status: 404 })
      }
      characterIdea = String(saved.character_idea ?? 'reusable saved character')
      imagePrompt = String(saved.character_image_prompt ?? '')
      // Refresh the actor's last_used_at so it floats to the top of the list.
      await supabase
        .from('user_saved_actors')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', savedActorId)
        .eq('user_id', userId)
    } else {
      const productCategory = hasProduct
        ? await inferProductCategory({ productName: safeProductName, productDescription: safeProductDescription })
        : undefined
      const built = await buildCharacterImagePrompt({
        productName: safeProductName,
        productDescription: safeProductDescription,
        productCategory,
        videoDirection: safeVideoDirection || undefined,
        customPersona,
        hasProductImage: hasProduct,
        formatKey: safeFormatKey,
        formatSpec: campaignFormat?.sonnetSpec,
        hasPackagingRef: extraProductRefs.length > 0,
        productType: safeProductType,
      })
      characterIdea = built.characterIdea
      imagePrompt = built.imagePrompt
    }

    // Hard imperative override — append the shot-direction verbatim to the
    // end of whatever Sonnet produced (or whatever was loaded from a saved
    // actor). Sonnet's rewrite tends to water composition down; putting the
    // direction after the paragraph, framed as OVERRIDING everything above,
    // gives Nano Banana Pro an unambiguous instruction it can't ignore.
    if (safeFormatKey && (SHOT_DIRECTIONS[safeFormatKey] || safeFormatKey === 'unboxing')) {
      const direction = shotDirectionFor(safeFormatKey, { hasPackagingRef: extraProductRefs.length > 0 })
      if (direction) {
        imagePrompt = `${imagePrompt}\n\n=== SHOT COMPOSITION — MANDATORY, OVERRIDES ANYTHING ABOVE ===\n${direction}\n============================================================`
      }
    }
    // When the "product" is a website, hard-append the app-demo composition
    // override too — same pattern as the shot-direction block, so Nano Banana
    // Pro sees an unambiguous instruction to render the reference image ON
    // a device screen instead of treating it as a physical product to hold.
    if (safeProductType === 'website') {
      const angleNote = primaryAngle
        ? `\n\nThe FIRST reference image is the EXACT app UI (screen: ${primaryAngle}) — the character's device screen MUST faithfully match this specific screen (not a mash-up of the other references).${extraAngles.length ? ` The next ${extraAngles.length} image(s) are additional UI screens (${extraAngles.filter(Boolean).join(', ') || 'other screens'}) — use them ONLY for supplementary brand detail (colours, typography, logo). The DEVICE SCREEN must primarily show the FIRST image.` : ''}`
        : ''
      imagePrompt = `${imagePrompt}\n\n=== WEBSITE PRODUCT — MANDATORY, OVERRIDES ANYTHING ABOVE ===\n${websiteProductDirection(safeFormatKey)}${angleNote}\n============================================================`
    }
    // Physical products with angle labels — nudge NB to interpret each ref as
    // a specific view (front / back / label close-up / packaging / etc).
    if (safeProductType === 'physical' && primaryAngle) {
      imagePrompt = `${imagePrompt}\n\nREFERENCE ANGLES: the FIRST reference is the ${primaryAngle} view of the product.${extraAngles.filter(Boolean).length ? ` Additional refs: ${extraAngles.filter(Boolean).join(', ')}.` : ''}`
    }

    // Scene relevance — when reusing a saved actor / influencer, their
    // stored prompt + reference photos carry the ORIGINAL location (e.g.
    // penthouse portrait). If this video's script needs a specific place
    // (car, mountain, gym…), the hero frame must show the character IN
    // that place or Seedance opens the video in the wrong location.
    // Haiku decides; generic talking-head scripts reuse the look as-is.
    let requiredScene: string | null = null
    // Explicit Scene Studio selection — the user picked a saved environment.
    // This wins over the Haiku auto-detection: if they picked "Brooklyn Café",
    // that's the scene, no need to ask Haiku whether one matters.
    let sceneAnchorRef: { base64: string; mimeType: string } | null = null
    if (typeof sceneId === 'string' && sceneId.length > 0) {
      try {
        const { data: sceneRow } = await supabase
          .from('user_scenes')
          .select('id, name, scene_prompt, hero_image_url, reference_urls')
          .eq('id', sceneId)
          .eq('user_id', userId)
          .maybeSingle()
        if (sceneRow) {
          requiredScene = `${sceneRow.name} — ${sceneRow.scene_prompt}`.slice(0, 800)
          const originals: string[] = Array.isArray(sceneRow.reference_urls)
            ? (sceneRow.reference_urls as string[]).filter(u => typeof u === 'string' && u.startsWith('http'))
            : []
          const anchorUrl = originals[0] ?? sceneRow.hero_image_url
          if (typeof anchorUrl === 'string' && anchorUrl.startsWith('http')) {
            try {
              const r = await fetch(anchorUrl)
              if (r.ok) {
                sceneAnchorRef = {
                  base64: Buffer.from(await r.arrayBuffer()).toString('base64'),
                  mimeType: r.headers.get('content-type') || 'image/png',
                }
              }
            } catch { /* soft fail — the scene_prompt still travels */ }
          }
          // Bump last_used_at so the picker sorts recently-used scenes to top.
          void supabase.from('user_scenes').update({ last_used_at: new Date().toISOString() }).eq('id', sceneId).eq('user_id', userId)
          console.log('[hero-frames] scene locked to:', sceneRow.name)
        }
      } catch (err) {
        console.warn('[hero-frames] scene fetch failed:', err instanceof Error ? err.message : err)
      }
    }
    const reusingIdentity = (typeof savedActorId === 'string' && savedActorId.length > 0)
      || (typeof influencerId === 'string' && influencerId.length > 0)
    // If the campaign format already implies a specific scene (requiresScene:
    // true, e.g. GRWM = bathroom vanity, TV spot = cinematic setting), skip
    // the Haiku scene-relevance detector and use the format's implied scene
    // directly. Saves a Haiku call and gives the shot-direction override
    // undisputed control over framing.
    if (reusingIdentity && !requiredScene && campaignFormat?.requiresScene) {
      requiredScene = `${campaignFormat.label} — ${campaignFormat.sonnetSpec}`.slice(0, 400)
      console.log('[hero-frames] scene from format:', campaignFormat.key)
    }
    if (reusingIdentity && !requiredScene) {
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const scriptText = typeof body.script === 'string' ? body.script.slice(0, 2000) : ''
        const msg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 120,
          system: `You read a UGC ad script + direction and decide whether a SPECIFIC on-camera location or activity setting is required. Reply ONLY JSON: {"important": true|false, "scene": "one-line description of the required setting"}.
important=true when the script/direction clearly implies a place or activity environment (in a car, on a mountain trail, at the gym, cooking in a kitchen, at the beach, unboxing at a desk…).
important=false when it is a generic talking-head that could be filmed anywhere.`,
          messages: [{ role: 'user', content: `SCRIPT:\n${scriptText || '(none)'}\n\nDIRECTION:\n${safeVideoDirection || '(none)'}` }],
        })
        const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim().replace(/^```json?\n?/i, '').replace(/\n?```$/, '')
        const parsed = JSON.parse(raw) as { important?: boolean; scene?: string }
        if (parsed.important && typeof parsed.scene === 'string' && parsed.scene.trim()) {
          requiredScene = parsed.scene.trim().slice(0, 200)
          console.log('[hero-frames] scene matters:', requiredScene)
        } else {
          console.log('[hero-frames] scene not important — reusing stored look')
        }
      } catch (err) {
        console.warn('[hero-frames] scene analysis failed, reusing stored look:', err instanceof Error ? err.message : err)
      }
    }
    if (requiredScene) {
      imagePrompt = `${imagePrompt}\n\nSCENE OVERRIDE — CRITICAL: the character is physically IN this location right now: ${requiredScene}. The ENTIRE background and environment must read as this scene. IGNORE any location, room, or background implied by the text above or by the reference photos — keep ONLY the person's face, hair, and identity from them, not their surroundings.${sceneAnchorRef ? ' The LAST attached image is the EXACT scene — architecture, materials, decor, palette, and lighting must match it faithfully.' : ''}`
    }

    // Influencer identity references. When the character came from the
    // Influencer Studio, the frames should be anchored to their actual
    // photos, not regenerated from the text prompt alone (text-only
    // regeneration drifts the face between sessions).
    //  - influencerPhotoUrl set → the user hand-picked one gallery photo.
    //  - else → "AI uses the gallery": canonical portrait + up to 2 most
    //    recent photoshoot photos as combined identity references.
    let identityRefs: Array<{ base64: string; mimeType: string }> = []
    if (typeof influencerId === 'string' && influencerId.length > 0) {
      try {
        const refUrls: string[] = []
        if (typeof influencerPhotoUrl === 'string' && influencerPhotoUrl.startsWith('http')) {
          refUrls.push(influencerPhotoUrl)
        } else {
          const [{ data: inf }, { data: pics }] = await Promise.all([
            supabase.from('user_influencers').select('portrait_url, character_sheet_url').eq('id', influencerId).eq('user_id', userId).maybeSingle(),
            supabase.from('user_influencer_photos').select('image_url').eq('influencer_id', influencerId).eq('user_id', userId)
              .order('created_at', { ascending: false }).limit(2),
          ])
          // The turnaround sheet is the strongest identity anchor — first.
          if (inf?.character_sheet_url) refUrls.push(inf.character_sheet_url)
          if (inf?.portrait_url) refUrls.push(inf.portrait_url)
          for (const p of pics ?? []) refUrls.push(p.image_url)
        }
        identityRefs = (await Promise.all(refUrls.slice(0, 3).map(async url => {
          const r = await fetch(url)
          if (!r.ok) return null
          return {
            base64: Buffer.from(await r.arrayBuffer()).toString('base64'),
            mimeType: r.headers.get('content-type') || 'image/png',
          }
        }))).filter((x): x is { base64: string; mimeType: string } => !!x)
      } catch (err) {
        console.warn('[hero-frames] influencer refs load failed, text-only identity:', err instanceof Error ? err.message : err)
      }
    }

    // Generate one hero frame from the Sonnet-drafted prompt. When a
    // physical product is provided we attach its image as reference so
    // packaging + label stay accurate.
    async function generateOne(): Promise<{ base64: string; mimeType: string }> {
      if (hasProduct) {
        const f = await generateCharacterWithProduct(
          productImageBase64 as string,
          productImageMimeType as string,
          safeProductName,
          imagePrompt,
          requiredScene ?? '',   // explicit scene override when the script needs a place
          undefined,          // no legacy custom-instructions inject
          aspect.nanoBananaRatio,
          identityRefs[0]?.base64,     // influencer identity anchor (if any)
          identityRefs[0]?.mimeType,
          extraProductRefs.length ? extraProductRefs : undefined,
        )
        return { base64: f.imageBase64, mimeType: f.mimeType }
      }
      if (identityRefs.length) {
        // No product but we have identity refs — image-to-image so the
        // frames ARE this influencer, not a lookalike. Append the scene
        // anchor at the end when we have one so NB matches the location
        // faithfully instead of inventing a room.
        const combined = sceneAnchorRef ? [...identityRefs, sceneAnchorRef] : identityRefs
        const f = await generateNanoBananaImage(imagePrompt, {
          style: 'realistic',
          ratio: aspect.nanoBananaRatio === '1:1' ? '1:1' : aspect.nanoBananaRatio === '16:9' ? '16:9' : '9:16',
          referenceImages: combined,
          referenceHint: sceneAnchorRef
            ? 'The FIRST reference image(s) define the exact person — preserve their face, hair, skin tone, and identity precisely. The LAST image is the EXACT scene — architecture, materials, decor, palette, and lighting must match it faithfully. Compose the person INSIDE this scene.'
            : 'The person in the attached reference photo(s) IS this exact character — preserve their face, hair, skin tone, and identity precisely. Apply the prompt as scene + framing around them.',
        })
        return { base64: f.imageBase64, mimeType: f.mimeType }
      }
      // No product, no identity refs — text-only from the Sonnet image
      // prompt, plus the scene anchor when the user picked one.
      if (sceneAnchorRef) {
        const f = await generateNanoBananaImage(imagePrompt, {
          style: 'realistic',
          ratio: aspect.nanoBananaRatio === '1:1' ? '1:1' : aspect.nanoBananaRatio === '16:9' ? '16:9' : '9:16',
          referenceImages: [sceneAnchorRef],
          referenceHint: 'The attached image is the EXACT scene — architecture, materials, decor, palette, and lighting must match it faithfully. Compose the person INSIDE this scene from the prompt.',
        })
        return { base64: f.imageBase64, mimeType: f.mimeType }
      }
      const f = await generateTextToImage(imagePrompt)
      return { base64: f.imageBase64, mimeType: f.mimeType }
    }

    // Fan out 4 in parallel. Each Nano Banana call uses different noise so
    // the outputs come back visibly distinct.
    const settled = await Promise.allSettled([generateOne(), generateOne(), generateOne(), generateOne()])
    const successes = settled.filter((r): r is PromiseFulfilledResult<{ base64: string; mimeType: string }> => r.status === 'fulfilled')
    if (successes.length === 0) {
      const first = settled.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined
      throw new Error(first?.reason?.message ?? 'All hero frames failed to render')
    }

    // Resize + upload each. Return public URLs (Kling and the client both use
    // URLs, not base64, once the frame is in Supabase Storage).
    const stamp = Date.now()
    const frames: string[] = []
    for (let i = 0; i < successes.length; i++) {
      const { base64 } = successes[i].value
      const resized = await sharp(Buffer.from(base64, 'base64'))
        .resize(aspect.width, aspect.height, { fit: 'cover', position: 'center' })
        .png()
        .toBuffer()
      const filename = `kling-source/${userId}-${stamp}-${i}.png`
      const { error: upErr } = await supabase.storage
        .from('ugc-assets')
        .upload(filename, resized, { contentType: 'image/png', upsert: false })
      if (upErr) continue
      const { data: pub } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
      frames.push(pub.publicUrl)
    }

    // When the hero frames were rendered against a saved influencer, also
    // file them into that influencer's photo library so the user can reuse
    // them later as reference photos or portraits.
    if (typeof influencerId === 'string' && influencerId.length > 0 && frames.length > 0) {
      const sceneLabel = (requiredScene ?? safeVideoDirection ?? 'UGC hero frame').toString().slice(0, 200)
      try {
        await supabase.from('user_influencer_photos').insert(
          frames.map(url => ({ influencer_id: influencerId, user_id: userId, scene: sceneLabel, image_url: url })),
        )
      } catch (err) {
        console.warn('[hero-frames] library insert failed:', err instanceof Error ? err.message : err)
      }
    }

    if (frames.length === 0) {
      return NextResponse.json({ error: 'Failed to upload any hero frames.' }, { status: 500 })
    }

    return NextResponse.json({
      frames,
      characterIdea,
      // imagePrompt is used later by /api/ugc/save-actor to reuse the exact
      // character seed on future generations.
      characterImagePrompt: imagePrompt,
    })
  } catch (err) {
    console.error('ugc/hero-frames error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Hero frame generation failed' },
      { status: 500 },
    )
  }
}
