import { deductCredits } from '@/lib/deduct-credits'
import { generateImage } from '@/lib/gemini-image'
import { generateCharacterWithProduct, ugcifyPortrait, generateCharacterInFrontOfUI } from '@/lib/nanobanana'
import { submitKlingV3OmniJob } from '@/lib/replicate'
import { buildKlingPrompt } from '@/lib/kling-prompt'
import { CREDIT_COSTS } from '@/lib/credits'
import {
  TIERS,
  DEFAULT_TIER,
  DEFAULT_DURATION,
  DURATION_OPTIONS,
  DURATION_CONFIGS,
  calculateVideoCredits,
  type UGCTier,
  type UGCDuration,
} from '@/lib/tiers'
import { buildCharacterPrompt, type CharacterProfile } from '@/lib/character'
import { generateUGCScript, replaceHook, extractSpokenLines } from '@/lib/ugc-script'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

// === UGC pipeline (Kling v3 omni-video) ===
// 1. Claude writes the script (HOOK, BODY, CTA + background)
// 2. Nano Banana Pro generates the character holding the product (hero frame)
// 3. Hero frame resized to the chosen aspect's exact dimensions
// 4. Claude builds a Kling v3 prompt that embeds the spoken script
// 5. Kling v3 omni-video generates the talking head WITH native synced audio
//    (no separate TTS, no lip-sync post-pass, no B-rolls — one model does it all)
// 6. For 20s: chain a second Kling clip with the same hero frame as start_image
// 7. Client polls /api/ugc/video-status until done, then calls /api/ugc/stitch
//    for captions + watermark.

export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.slice(7))
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = userData.user.id
    const body = await request.json()
    const {
      ugcType,
      productName,
      productDescription,
      benefits,
      callToAction,
      style = 'realistic',
      productImageBase64,
      productImageMimeType,
      selectedHook,
      avatarGender,
      character: characterFromForm,
      customInstructions,
      language: languageRaw,
      aspect: aspectRaw,
      actorId,
      customPhotoBase64,
      customPhotoMimeType,
      productType, // 'physical' | 'software'
      prewrittenScript,
    } = body

    const { getLanguage } = await import('@/lib/languages')
    const language = getLanguage(typeof languageRaw === 'string' ? languageRaw : undefined)

    const { getAspect } = await import('@/lib/aspects')
    const aspect = getAspect(typeof aspectRaw === 'string' ? aspectRaw : undefined)

    let safeCustomInstructions = typeof customInstructions === 'string'
      ? customInstructions.slice(0, 1500).trim() || undefined
      : undefined

    // Pull brand context (audience + tone) — non-fatal if it fails.
    try {
      const { data: brand } = await supabase
        .from('brand_profiles')
        .select('target_audience, tone_of_voice')
        .eq('user_id', userId)
        .maybeSingle()
      const audience = brand?.target_audience?.trim()
      const tone = brand?.tone_of_voice?.trim()
      if (audience || tone) {
        const brandLines = [
          audience ? `Target audience: ${audience}` : '',
          tone ? `Tone of voice: ${tone}` : '',
        ].filter(Boolean).join('\n')
        safeCustomInstructions = safeCustomInstructions
          ? `${brandLines}\n\n${safeCustomInstructions}`
          : brandLines
        if (safeCustomInstructions.length > 1500) {
          safeCustomInstructions = safeCustomInstructions.slice(0, 1500)
        }
      }
    } catch { /* non-fatal */ }

    const character: CharacterProfile | undefined = characterFromForm

    // Single-tier system now — Kling v3 omni handles both visuals and voice.
    const tier: UGCTier = DEFAULT_TIER
    void TIERS // keep import meaningful for future tier work

    // Duration: validate against the new Kling-native set (5/10/15/20).
    const rawDuration = Number(body.duration ?? DEFAULT_DURATION)
    const allowedDurations: readonly number[] = DURATION_OPTIONS
    const dCfg = allowedDurations.includes(rawDuration) ? DURATION_CONFIGS[rawDuration] : null
    const duration: UGCDuration = dCfg?.available
      ? (rawDuration as UGCDuration)
      : DEFAULT_DURATION
    const durationConfig = DURATION_CONFIGS[duration]

    // Only ugcType is truly required. productName/description/benefits are
    // treated as topic/context — if a user wants a non-product talking-head
    // (travel vlog, personal take, opinion piece), they can leave them blank
    // and rely on customInstructions + character.scene to describe the video.
    if (!ugcType) {
      return NextResponse.json({ error: 'Missing ugcType' }, { status: 400 })
    }
    // Backfill so downstream string interpolation doesn't render "undefined".
    const safeProductName = String(productName || 'the topic').trim() || 'the topic'
    const safeProductDescription = String(productDescription || 'general talking-head content').trim() || 'general talking-head content'
    const safeBenefits = String(benefits || 'engaging story').trim() || 'engaging story'

    let totalCost = 0
    if (ugcType === 'image-with-voiceover' || ugcType === 'all') totalCost += CREDIT_COSTS.image
    if (ugcType === 'video-with-voiceover' || ugcType === 'all') totalCost += calculateVideoCredits(tier, duration)

    const { data: userCredits } = await supabase.from('user_credits').select('balance, pack_credits').eq('user_id', userId).maybeSingle()
    if (!userCredits || userCredits.balance < totalCost) {
      return NextResponse.json({ error: `Insufficient credits. Need ${totalCost}, have ${userCredits?.balance ?? 0}` }, { status: 400 })
    }

    // === Script ===
    const forcedScene = character?.scene?.trim() ? character.scene.toLowerCase() : undefined
    let script: string
    if (typeof prewrittenScript === 'string' && prewrittenScript.trim()) {
      // User pre-approved a script — skip Claude generation entirely.
      const trimmed = prewrittenScript.trim()
      script = selectedHook && typeof selectedHook === 'string' && selectedHook.trim()
        ? replaceHook(trimmed, selectedHook.trim())
        : trimmed
    } else {
      const baseScript = await generateUGCScript(
        safeProductName,
        safeProductDescription,
        safeBenefits,
        callToAction || 'Try it today',
        productImageBase64,
        productImageMimeType,
        duration,
        forcedScene,
        safeCustomInstructions,
        { name: language.name, code: language.code },
        (productType === 'software' || productType === 'physical') ? productType : undefined,
      )
      script = selectedHook && typeof selectedHook === 'string' && selectedHook.trim()
        ? replaceHook(baseScript, selectedHook.trim())
        : baseScript
    }

    const components: Record<string, any> = { script, language: language.code, aspect: aspect.id }

    // Optional image-only path (unchanged).
    if (ugcType === 'image-with-voiceover' || ugcType === 'all') {
      const imageResult = await generateImage(
        `Hero visual of ${safeProductName}. ${safeProductDescription}. Style: ${style}. ${productImageBase64 ? 'Clean background, studio lighting, commercial quality.' : 'Cinematic composition, natural light.'}`,
        productImageBase64,
        productImageMimeType,
      )
      components.image = { url: imageResult.imageUrl, id: `gemini-${Date.now()}` }
    }

    // === Video pipeline (Kling v3 omni-video) ===
    if (ugcType === 'video-with-voiceover' || ugcType === 'all') {
      const spokenScript = extractSpokenLines(script)

      const bgMatch = script.match(/\[BACKGROUND:\s*([^\]]+)\]/i)
      const backgroundContext = bgMatch?.[1]?.trim() ?? 'casual indoor setting'

      if (!process.env.REPLICATE_API_TOKEN) {
        return NextResponse.json({ error: 'UGC pipeline requires REPLICATE_API_TOKEN (Nano Banana + Kling)' }, { status: 500 })
      }

      // Resolve actor portrait: library actor → load from disk; custom photo → use directly.
      let actorPortraitBase64: string | undefined
      let actorPortraitMimeType: string | undefined

      if (actorId && typeof actorId === 'string') {
        try {
          const { default: fs } = await import('fs/promises')
          const { default: path } = await import('path')
          const portraitPath = path.join(process.cwd(), 'public', 'actors', `${actorId}.jpg`)
          const buf = await fs.readFile(portraitPath)
          actorPortraitBase64 = buf.toString('base64')
          actorPortraitMimeType = 'image/jpeg'
        } catch {
          // portrait not found — fall back to text-only character description
        }
      } else if (typeof customPhotoBase64 === 'string' && typeof customPhotoMimeType === 'string') {
        actorPortraitBase64 = customPhotoBase64
        actorPortraitMimeType = customPhotoMimeType
      }

      const hasProduct = !!(productImageBase64 && productImageMimeType)
      const hasActorPhoto = !!(actorPortraitBase64 && actorPortraitMimeType)

      if (!hasProduct && !hasActorPhoto) {
        return NextResponse.json({ error: 'Please provide a product photo or select an actor / upload your photo.' }, { status: 400 })
      }

      // 1. Build the hero frame via Nano Banana (or use portrait directly for library actor + no product).
      const characterPrompt = character && character.gender
        ? buildCharacterPrompt(character)
        : avatarGender === 'Male'
          ? 'late 20s man, candid expression, real skin texture with pores and slight imperfections, natural hair with flyaways, casual outfit appropriate to the scene'
          : 'late 20s woman, candid expression, real skin texture with pores and slight imperfections, natural hair with flyaways, casual outfit appropriate to the scene'

      const heroScene = character?.scene?.trim() ? character.scene.toLowerCase() : backgroundContext

      let heroBase64: string
      let heroMimeType: string

      if (hasProduct && productType === 'software') {
        // Software path: Nano Banana composites the character in front of a large screen
        // showing the UI screenshot — no green screen, no chroma key needed.
        const uiFrame = await generateCharacterInFrontOfUI(
          productImageBase64!,
          productImageMimeType!,
          characterPrompt,
          aspect.nanoBananaRatio,
          actorPortraitBase64,
          actorPortraitMimeType,
        )
        heroBase64 = uiFrame.imageBase64
        heroMimeType = uiFrame.mimeType
      } else if (hasProduct) {
        const heroFrame = await generateCharacterWithProduct(
          productImageBase64!,
          productImageMimeType!,
          safeProductName,
          characterPrompt,
          heroScene,
          safeCustomInstructions,
          aspect.nanoBananaRatio,
          actorPortraitBase64,
          actorPortraitMimeType,
        )
        heroBase64 = heroFrame.imageBase64
        heroMimeType = heroFrame.mimeType
      } else if (actorId && actorPortraitBase64) {
        // Library actor, no product — use portrait directly as start frame
        heroBase64 = actorPortraitBase64
        heroMimeType = actorPortraitMimeType!
      } else {
        // Custom photo, no product — ugcify it
        const ugcFrame = await ugcifyPortrait(
          actorPortraitBase64!,
          actorPortraitMimeType!,
          heroScene,
          characterPrompt,
          aspect.nanoBananaRatio,
        )
        heroBase64 = ugcFrame.imageBase64
        heroMimeType = ugcFrame.mimeType
      }

      // 2. Resize to the chosen aspect's exact dimensions (cover + center-crop).
      const resizedHero = await sharp(Buffer.from(heroBase64, 'base64'))
        .resize(aspect.width, aspect.height, { fit: 'cover', position: 'center' })
        .png()
        .toBuffer()

      const heroFilename = `kling-source/${userId}-${Date.now()}.png`
      const { error: heroErr } = await supabase.storage
        .from('ugc-assets')
        .upload(heroFilename, resizedHero, { contentType: 'image/png', upsert: false })
      if (heroErr) throw new Error(`Failed to upload Kling source frame: ${heroErr.message}`)
      const { data: { publicUrl: heroUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(heroFilename)

      // 3. Claude builds the Kling v3 prompt (motion-first, embeds the spoken script).
      const klingPrompt = await buildKlingPrompt({
        productName: safeProductName,
        productDescription: safeProductDescription,
        scene: backgroundContext,
        script: spokenScript,
        language: language.name,
        customInstructions: safeCustomInstructions,
        gender: (avatarGender === 'Male' || character?.gender === 'Male') ? 'Male' : 'Female',
      })

      // 4. Submit the Kling v3 omni clip(s).
      // For 20s we chain 2x15s with the same hero frame as start_image (since 15s is Kling's max).
      const klingSeconds = durationConfig.klingSeconds
      const clipCount = durationConfig.klingClips

      const primary = await submitKlingV3OmniJob({
        prompt: klingPrompt,
        startImageUrl: heroUrl,
        durationSeconds: klingSeconds,
        aspectRatio: aspect.nanoBananaRatio,
      })

      let secondary: { predictionId: string } | undefined
      if (clipCount >= 2) {
        // Same start frame so the character is consistent across the chain.
        secondary = await submitKlingV3OmniJob({
          prompt: klingPrompt,
          startImageUrl: heroUrl,
          durationSeconds: klingSeconds,
          aspectRatio: aspect.nanoBananaRatio,
        })
      }

      components.video = {
        videoId: primary.predictionId,
        status: 'processing',
        provider: 'kling-v3-omni',
        duration,
        estimatedDuration: duration,
        chainedIds: secondary ? [secondary.predictionId] : undefined,
      }

      // Save to DB immediately after Kling submission — never lose a prediction id to a timeout.
      await supabase.from('ugc_content').insert({
        user_id: userId,
        content_type: 'video',
        external_id: `ugc-${Date.now()}`,
        storage_url: JSON.stringify(components),
        metadata: { ugcType, productName, productDescription, benefits, callToAction, script, tier, generatedAt: new Date().toISOString() },
        credit_cost: totalCost,
        status: 'generating',
      })
      const { newBalance: newBalanceVideo } = await deductCredits(supabase, userId, totalCost, userCredits.balance, userCredits.pack_credits)
      await supabase.from('credit_transactions').insert({
        user_id: userId, amount: totalCost, transaction_type: 'generation',
        content_type: 'ugc_package', description: `UGC package: ${productName} (Kling v3 omni)`,
      })

      return NextResponse.json({
        success: true, ugcType, components, script,
        creditDeducted: totalCost, newBalance: newBalanceVideo,
      }, { status: 201 })
    }

    // image-only path falls through to single DB save
    const { error: insertError } = await supabase.from('ugc_content').insert({
      user_id: userId,
      content_type: 'image',
      external_id: `ugc-${Date.now()}`,
      storage_url: JSON.stringify(components),
      metadata: { ugcType, productName, productDescription, benefits, callToAction, script, generatedAt: new Date().toISOString() },
      credit_cost: totalCost,
      status: 'completed',
    })

    if (insertError) {
      console.error('DB insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save UGC package' }, { status: 500 })
    }

    const { newBalance } = await deductCredits(supabase, userId, totalCost, userCredits.balance, userCredits.pack_credits)
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: totalCost,
      transaction_type: 'generation',
      content_type: 'ugc_package',
      description: `UGC package: ${productName}`,
    })

    return NextResponse.json({
      success: true,
      ugcType,
      components,
      script,
      creditDeducted: totalCost,
      newBalance,
    }, { status: 201 })

  } catch (error) {
    console.error('UGC orchestration error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Generation failed' }, { status: 500 })
  }
}
