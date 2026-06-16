import { generateImage } from '@/lib/gemini-image'
import { submitVideoJob, estimateDuration, fallbackVoiceForGender, inferAvatarGender } from '@/lib/heygen'
import { generateActionFrame, generateCharacterWithProduct } from '@/lib/nanobanana'
import { submitSoraJob } from '@/lib/sora'
import { buildSoraPrompt } from '@/lib/sora-prompt'
import { generateSpeech } from '@/lib/tts'
import { submitBrollJob } from '@/lib/kling'
import { CREDIT_COSTS } from '@/lib/credits'
import { TIERS, DEFAULT_TIER, type UGCTier } from '@/lib/tiers'
import { buildCharacterPrompt, type CharacterProfile } from '@/lib/character'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import sharp from 'sharp'

// Sora 2 requires the reference image dimensions to EXACTLY match the requested size
// (the model treats it as an inpaint base). Nano Banana outputs vary — usually 1024×1024 —
// so we always resize + center-crop before submitting.
const SORA_SIZE = '720x1280' // 9:16 portrait, Sora 2's supported vertical size
const [SORA_W, SORA_H] = SORA_SIZE.split('x').map(Number)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function generateUGCScript(
  productName: string,
  productDescription: string,
  benefits: string,
  callToAction: string,
  productImageBase64?: string,
  productImageMimeType?: string,
  // NEW: total target duration in seconds. Sora caps clips at 12s — without this,
  // Claude wrote 30s scripts that got cut off mid-sentence on Hero (12s) and Premium (8s).
  targetDurationSeconds: number = 30,
  // NEW: when the user picks a scene in the character questionnaire, force it here
  // so [BACKGROUND:] matches what Sora renders. Otherwise Claude invents one and the
  // questionnaire choice is ignored downstream.
  forcedScene?: string,
): Promise<string> {
  // Spoken pace ≈ 150 words/min ≈ 2.5 words/sec. Reserve ~1s padding so audio
  // never runs past the video.
  const targetWords = Math.max(8, Math.round((targetDurationSeconds - 1) * 2.5))
  const hookEnd = Math.min(5, Math.round(targetDurationSeconds * 0.2))
  const bodyEnd = Math.round(targetDurationSeconds * 0.85)

  const backgroundLine = forcedScene
    ? `[BACKGROUND: ${forcedScene}]   ← USE THIS EXACT SCENE, do not change it`
    : `[BACKGROUND: one of: bedroom, bathroom, kitchen, living room, office, gym, outdoor, car interior, cafe]`

  const textPrompt = `Write a ${targetDurationSeconds}-SECOND UGC video script for a social media ad. The TOTAL spoken word count across HOOK + BODY + CTA must be ${targetWords} words or fewer — this is a hard limit because the video will be cut at ${targetDurationSeconds}s. Count carefully.

Product: ${productName}
Description: ${productDescription}
Benefits: ${benefits}
CTA: ${callToAction}

Use this exact format:

${backgroundLine}

[HOOK — 0:00 to 0:0${hookEnd}]
(brief expression/tone note)
"spoken hook line — grabs attention immediately"

[BODY — 0:0${hookEnd} to 0:${bodyEnd < 10 ? '0' + bodyEnd : bodyEnd}]
(tone note)
"spoken body — authentic, conversational. Keep it tight — total script ≤ ${targetWords} words."

[CTA — 0:${bodyEnd < 10 ? '0' + bodyEnd : bodyEnd} to 0:${targetDurationSeconds}]
(tone note)
"spoken CTA — natural, confident, very short"

Rules:
- TOTAL spoken word count ≤ ${targetWords} — count every word in every quoted line. This is the most important rule.
- Spoken text always in double quotes
- Stage directions always in (parentheses)
- Section headers always in [brackets]
- ${forcedScene ? `[BACKGROUND: ${forcedScene}] must be the very first line, use it exactly` : '[BACKGROUND: ...] must be the very first line — choose what fits the product naturally'}
- No markdown, no title, no hashtags
- Authentic UGC tone — real person, not corporate`

  const content: Anthropic.MessageParam['content'] = productImageBase64
    ? [
        { type: 'image', source: { type: 'base64', media_type: productImageMimeType as 'image/jpeg' | 'image/png' | 'image/webp', data: productImageBase64 } },
        { type: 'text', text: textPrompt },
      ]
    : textPrompt

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content }],
  })

  return (msg.content[0] as { text: string }).text.trim()
}

// Generate 2 ACTION DESCRIPTIONS for B-rolls — these describe what physically happens at
// the action peak (mid-spray, mid-apply, mid-bite). They feed Nano Banana to produce a
// frozen-mid-action frame, which Kling then animates forward via image-to-video.
// Action 1 = application (the moment of use). Action 2 = result/sensory (reaction, after-effect).
async function generateBrollActions(
  productName: string,
  productDescription: string,
  background: string,
  imageBase64?: string,
  imageMimeType?: string,
): Promise<[string, string]> {
  const textPrompt = `Decide the most natural way a real person would USE "${productName}" (${productDescription}), then write 2 action descriptions for UGC ad B-roll frames. Setting: ${background}.
${imageBase64 ? 'The image above shows the actual product — base your action choices on what type of product this is.\n' : ''}
ACTION 1 — Application moment: the actual physical motion of using the product, mid-action. Examples by product type:
- Skincare/serum: fingers mid-application on cheek with product trail visible, partial side profile
- Perfume: wrist mid-spray with mist droplets in the air, fingertip on nozzle
- Food/drink: glass mid-tilt to lips with liquid in motion, or fork mid-lift with food
- Supplement/pill: hand mid-tip of bottle into palm, capsule mid-fall
- Hair: hands mid-massage of product into scalp/hair, strands mid-motion
- Tech/device: thumb mid-tap on the device, finger pressing a button mid-press

ACTION 2 — Reaction / sensory moment: the result of having just used it, mid-feeling. Examples:
- Skincare: side profile, fingers gently pressing in the just-applied product, eyes lowered or closed
- Perfume: wrist raised to nose, neck tilted, eyes half-closed, mid-inhale
- Food/drink: mid-chew or mid-savor expression, eyes closed or focused
- Supplement: hand bringing a glass of water to lips after pill, mid-swallow throat motion
- Hair: head tilted, hand running through hair to feel the result, mid-motion
- Tech: hand holding/interacting with the device, satisfied expression

Each description should be a single concrete sentence: WHO (hands/wrist/side profile/etc.), DOING WHAT, mid-MOMENT.

Rules:
- Each description on its own line, ONLY the description, no labels or numbering
- Mid-action / mid-moment language — frozen at the action peak
- Body parts only (hands, wrist, neck, jawline, lips, eyes, partial face) — never full face
- Be specific to THIS product type, not generic
- Output ONLY the 2 lines, nothing else`

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: imageBase64
        ? [
            { type: 'image' as const, source: { type: 'base64' as const, media_type: (imageMimeType ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp', data: imageBase64 } },
            { type: 'text' as const, text: textPrompt },
          ]
        : textPrompt,
    }],
  })

  const lines = (msg.content[0] as { text: string }).text.trim().split('\n').filter(Boolean)
  return [
    lines[0] ?? `Hand mid-lift bringing ${productName} toward the camera, fingers wrapped around it, label angled toward camera`,
    lines[1] ?? `Side profile with fingers gently pressing the just-applied ${productName} into the skin, eyes lowered, mid-motion`,
  ]
}

// Replace the spoken line in the [HOOK ...] section with a user-picked hook.
// Preserves the section header, the (tone note) line, and everything else in the script.
function replaceHook(script: string, newHook: string): string {
  const lines = script.split('\n')
  let inHook = false
  let replaced = false
  const out: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (/^\[HOOK\b/i.test(t)) {
      inHook = true
      out.push(line)
      continue
    }
    if (inHook && /^\[/.test(t)) {
      inHook = false
      out.push(line)
      continue
    }
    if (inHook && !replaced && t && !t.startsWith('(') && !t.startsWith('[')) {
      out.push(`"${newHook.replace(/^["“”]|["“”]$/g, '').trim()}"`)
      replaced = true
      continue
    }
    out.push(line)
  }
  // If no [HOOK] section was found, prepend a synthetic one so TTS picks it up
  if (!replaced) return `[HOOK — 0:00 to 0:05]\n"${newHook}"\n\n${script}`
  return out.join('\n')
}

// Extract only the spoken lines (in "quotes") for sending to HeyGen TTS
function extractSpokenLines(script: string): string {
  const spoken: string[] = []
  for (const line of script.split('\n')) {
    const t = line.trim()
    // Skip section headers [HOOK...], stage directions (...), empty lines
    if (!t || t.startsWith('[') || t.startsWith('(')) continue
    // Collect lines that are quoted or plain text (strip surrounding quotes)
    const clean = t.replace(/^[""“”]|[""“”]$/g, '').trim()
    if (clean) spoken.push(clean)
  }
  return spoken.join(' ')
}

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
    const { ugcType, productName, productDescription, benefits, callToAction, style = 'realistic', imageSize = '1024x1024', avatarId, voiceId, productImageBase64, productImageMimeType, selectedHook, avatarGender, character: characterFromForm } = body
    const character: CharacterProfile | undefined = characterFromForm
    const rawTier = (body.tier as UGCTier | undefined) ?? DEFAULT_TIER
    const tier: UGCTier = TIERS[rawTier]?.available ? rawTier : DEFAULT_TIER
    const tierCfg = TIERS[tier]

    if (!ugcType || !productName || !productDescription || !benefits) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Calculate credit cost (video cost is tier-dependent)
    let totalCost = 0
    if (ugcType === 'image-with-voiceover' || ugcType === 'all') totalCost += CREDIT_COSTS.image
    if (ugcType === 'video-with-voiceover' || ugcType === 'all') totalCost += tierCfg.videoCredits

    const { data: userCredits } = await supabase.from('user_credits').select('balance').eq('user_id', userId).single()
    if (!userCredits || userCredits.balance < totalCost) {
      return NextResponse.json({ error: `Insufficient credits. Need ${totalCost}, have ${userCredits?.balance ?? 0}` }, { status: 400 })
    }

    // Generate Claude script first.
    // - Target duration: Sora tiers must fit inside the clip cap (12s Hero, 8s Premium).
    //   Lean uses HeyGen with no hard cap so 30s is fine.
    // - Forced scene: when the user picked one in the character questionnaire, lock it in
    //   so [BACKGROUND:] downstream uses the same scene Sora will render.
    const scriptTargetDuration = tierCfg.aRollProvider === 'sora-2' ? tierCfg.durationSeconds : 30
    const forcedScene = character?.scene?.trim() ? character.scene.toLowerCase() : undefined
    const baseScript = await generateUGCScript(
      productName,
      productDescription,
      benefits,
      callToAction || 'Try it today',
      productImageBase64,
      productImageMimeType,
      scriptTargetDuration,
      forcedScene,
    )
    const script = selectedHook && typeof selectedHook === 'string' && selectedHook.trim()
      ? replaceHook(baseScript, selectedHook.trim())
      : baseScript

    const components: Record<string, any> = { script }

    // Generate image if needed
    if (ugcType === 'image-with-voiceover' || ugcType === 'all') {
      const imageResult = await generateImage(
        `Professional product showcase photo of ${productName}. ${productDescription}. Style: ${style}. Clean background, studio lighting, commercial quality.`,
        productImageBase64,
        productImageMimeType,
      )
      components.image = { url: imageResult.imageUrl, id: `gemini-${Date.now()}` }
    }

    // Submit HeyGen video job
    if (ugcType === 'video-with-voiceover' || ugcType === 'all') {
      const spokenScript = extractSpokenLines(script)

      // Extract background hint from script (e.g. "[BACKGROUND: bathroom]")
      const bgMatch = script.match(/\[BACKGROUND:\s*([^\]]+)\]/i)
      const backgroundContext = bgMatch?.[1]?.trim() ?? 'casual indoor setting'

      // A-roll provider branches by tier:
      //   - 'heygen-stock' (Lean): pre-recorded HeyGen stock avatar + HeyGen TTS / ElevenLabs
      //   - 'sora-2'      (Premium, Hero): Nano Banana character+product hero frame → Sora 2
      //     image-to-video with native audio. No HeyGen, no ElevenLabs, no Sync.so.
      let videoId: string
      let aRollProvider: 'heygen' | 'sora-2'

      if (tierCfg.aRollProvider === 'sora-2') {
        aRollProvider = 'sora-2'
        if (!process.env.OPENAI_API_KEY) {
          return NextResponse.json({ error: 'Sora A-roll is not configured (OPENAI_API_KEY missing)' }, { status: 500 })
        }
        if (!productImageBase64 || !productImageMimeType) {
          return NextResponse.json({ error: 'Premium / Hero tier requires a product photo (used to anchor the AI character and product)' }, { status: 400 })
        }
        if (!process.env.REPLICATE_API_TOKEN) {
          return NextResponse.json({ error: 'Sora A-roll requires Nano Banana via Replicate (REPLICATE_API_TOKEN missing)' }, { status: 500 })
        }

        // 1. Nano Banana — character holding the real product, hyper-realistic phone-camera frame.
        // Build the character prompt from the user's CharacterBuilder answers when present (Premium/Hero).
        // Falls back to a generic prompt when the form character is missing or incomplete.
        const characterPrompt = character && character.gender
          ? buildCharacterPrompt(character)
          : avatarGender === 'Male'
            ? 'late 20s man, candid expression, real skin texture with pores and slight imperfections, natural hair with flyaways, casual outfit appropriate to the scene'
            : 'late 20s woman, candid expression, real skin texture with pores and slight imperfections, natural hair with flyaways, casual outfit appropriate to the scene'

        // User's chosen scene from the questionnaire overrides Claude's auto-extracted [BACKGROUND]
        const heroScene = character?.scene?.trim() ? character.scene.toLowerCase() : backgroundContext

        const heroFrame = await generateCharacterWithProduct(
          productImageBase64,
          productImageMimeType,
          productName,
          characterPrompt,
          heroScene,
        )

        // 2. Resize to Sora's exact dimensions (cover + center-crop, no distortion)
        const resizedHero = await sharp(Buffer.from(heroFrame.imageBase64, 'base64'))
          .resize(SORA_W, SORA_H, { fit: 'cover', position: 'center' })
          .png()
          .toBuffer()

        const heroFilename = `sora-source/${userId}-${Date.now()}.png`
        const { error: heroErr } = await supabase.storage
          .from('ugc-assets')
          .upload(heroFilename, resizedHero, { contentType: 'image/png', upsert: false })
        if (heroErr) throw new Error(`Failed to upload Sora source frame: ${heroErr.message}`)
        const { data: { publicUrl: heroUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(heroFilename)

        // 3. Hero tier only: generate voice audio to overlay on the muted Sora video later.
        // lib/tts dispatches to OpenAI TTS for 'openai:*' voice IDs or ElevenLabs otherwise,
        // with an automatic fallback to OpenAI 'nova' if ElevenLabs rejects the request
        // (e.g. free-plan library-voice block). So if TTS throws here, both providers are
        // broken — fail BEFORE charging credits.
        // Premium uses Sora's native audio (no extra cost, no voice control).
        let elevenLabsAudioUrl: string | undefined
        if (tierCfg.useElevenLabs) {
          try {
            const audioBuf = await generateSpeech(spokenScript, voiceId)
            const audioFilename = `audio-gen/${userId}-${Date.now()}.mp3`
            const { error: audioErr } = await supabase.storage
              .from('ugc-assets')
              .upload(audioFilename, audioBuf, { contentType: 'audio/mpeg', upsert: false })
            if (audioErr) {
              return NextResponse.json({ error: `Hero tier voice upload failed: ${audioErr.message}` }, { status: 500 })
            }
            const { data: { publicUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(audioFilename)
            elevenLabsAudioUrl = publicUrl
          } catch (err) {
            return NextResponse.json({
              error: `Hero tier voice generation failed (both ElevenLabs and OpenAI TTS): ${err instanceof Error ? err.message : 'unknown'}. No credits charged.`,
            }, { status: 502 })
          }
        }

        // 4. Claude builds the Sora 2 prompt (Camera→Subject→Action→...→Audio)
        const soraPrompt = await buildSoraPrompt({
          productName,
          productDescription,
          scene: backgroundContext,
          script: spokenScript,
        })

        // 5. Submit Sora 2 — returns immediately with a video id, client polls for completion
        const sora = await submitSoraJob({
          prompt: soraPrompt,
          referenceImageUrl: heroUrl,
          durationSeconds: tierCfg.durationSeconds as 4 | 8 | 12,
          size: SORA_SIZE,
        })
        videoId = sora.videoId
        if (elevenLabsAudioUrl) components.audioOverlayUrl = elevenLabsAudioUrl
      } else {
        // HeyGen stock path (Lean tier)
        aRollProvider = 'heygen'
        const effectiveAvatarId = avatarId || 'Daisy-inskirt-20220818'
        // HeyGen's avatar list often returns 'Unknown' / '' for gender. Treat anything
        // that isn't unambiguously male/female as "unset" so the name-based inference
        // (Bryan/Wayne/Marco/etc.) gets a chance to fire.
        const normalizedPickerGender =
          avatarGender && /^(m|man|male|masculine|f|female|woman|w)/i.test(avatarGender.trim())
            ? avatarGender
            : undefined
        const gender = normalizedPickerGender || inferAvatarGender(effectiveAvatarId)

        // Generate ElevenLabs audio if the tier asks for it
        let audioUrl: string | undefined
        if (tierCfg.useElevenLabs && process.env.ELEVENLABS_API_KEY) {
          try {
            const audioBuffer = await generateSpeech(spokenScript, voiceId)
            const audioFilename = `audio-gen/${userId}-${Date.now()}.mp3`
            const { error: audioErr } = await supabase.storage
              .from('ugc-assets')
              .upload(audioFilename, audioBuffer, { contentType: 'audio/mpeg', upsert: false })
            if (!audioErr) {
              const { data: { publicUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(audioFilename)
              audioUrl = publicUrl
            }
          } catch (err) {
            console.warn('ElevenLabs failed, using gender-matched HeyGen TTS fallback:', err instanceof Error ? err.message : err)
          }
        }

        const fallbackVoiceId = fallbackVoiceForGender(gender)
        console.log('[orchestrate] Lean voice pick:', {
          avatarId: effectiveAvatarId,
          avatarGenderFromClient: avatarGender,
          inferredGender: gender,
          usingElevenLabsAudio: !!audioUrl,
          fallbackVoiceId,
        })
        const hey = await submitVideoJob(spokenScript, effectiveAvatarId, fallbackVoiceId, undefined, audioUrl)
        videoId = hey.videoId
      }

      // ---- shared post-submit: save early, submit B-rolls, return ----
      components.video = { videoId, status: 'processing', provider: aRollProvider, estimatedDuration: estimateDuration(script) }

      // Save to DB immediately after HeyGen submits — never lose a video ID to a timeout
      const { data: ugcRow } = await supabase.from('ugc_content').insert({
        user_id: userId,
        content_type: 'video',
        external_id: `ugc-${Date.now()}`,
        storage_url: JSON.stringify(components),
        metadata: { ugcType, productName, productDescription, benefits, callToAction, script, tier, generatedAt: new Date().toISOString() },
        credit_cost: totalCost,
        status: 'generating',
      }).select('id').single()
      await supabase.from('user_credits').update({ balance: userCredits.balance - totalCost }).eq('user_id', userId)
      await supabase.from('credit_transactions').insert({
        user_id: userId, amount: totalCost, transaction_type: 'generation',
        content_type: 'ugc_package', description: `UGC package: ${productName} (${tier})`,
      })

      // Submit B-rolls after DB is saved. New action-driven pipeline:
      //   Claude → 2 action descriptions (application moment + reaction moment, product-specific)
      //   Nano Banana → 2 frozen-mid-action frames anchored on the real product image
      //   Kling image-to-video → animates each action frame forward into a 5s clip
      // Falls back gracefully: if Nano Banana fails for a frame, that slot uses Kling text-to-video
      // with the action description as the prompt. If everything is missing (no product image, no
      // Gemini key), both B-rolls use Kling text-to-video as before.
      const brollProviderReady = !!(process.env.REPLICATE_API_TOKEN || process.env.FAL_KEY || process.env.PIAPI_API_KEY)
      const brollActions = brollProviderReady && tierCfg.brollCount > 0
        ? await generateBrollActions(productName, productDescription, backgroundContext, productImageBase64, productImageMimeType).catch(() => null)
        : null

      if (brollActions) {
        const actionsToRender = brollActions.slice(0, tierCfg.brollCount)
        const canUseNanoBanana = !!(productImageBase64 && productImageMimeType && process.env.REPLICATE_API_TOKEN)

        // For each action: generate a Nano Banana action frame, upload, then submit Kling i2v.
        // Done in parallel — Nano Banana takes ~5s, can't block on it sequentially.
        const KLING_I2V_MOTION_PROMPT = 'Continue the action naturally from the starting frame — smooth realistic motion of the hands/body/product, 5 seconds, phone-camera handheld feel, soft natural lighting preserved, 9:16 vertical, no scene cuts, no new objects appearing'

        const submissions = await Promise.all(actionsToRender.map(async (action, i) => {
          if (canUseNanoBanana) {
            try {
              const frame = await generateActionFrame(productImageBase64!, productImageMimeType!, productName, action, backgroundContext)
              // Force 9:16 (720x1280) so Kling i2v inherits portrait aspect from the start frame.
              // Without this Nano Banana sometimes returned ~1:1 and Kling locked to that ratio,
              // which then got side-cropped by Shotstack's fit:cover into a too-tight portrait.
              const resized = await sharp(Buffer.from(frame.imageBase64, 'base64'))
                .resize(720, 1280, { fit: 'cover', position: 'center' })
                .png()
                .toBuffer()
              const filename = `nano-banana/${userId}-${Date.now()}-${i}.png`
              const { error: upErr } = await supabase.storage
                .from('ugc-assets')
                .upload(filename, resized, { contentType: 'image/png', upsert: false })
              if (!upErr) {
                const { data: { publicUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
                return await submitBrollJob(KLING_I2V_MOTION_PROMPT, publicUrl).catch(() => null)
              }
            } catch (err) {
              console.warn(`Nano Banana action frame ${i} failed, falling back to Kling text-to-video:`, err instanceof Error ? err.message : err)
            }
          }
          // Fallback: Kling text-to-video with the raw action description
          return await submitBrollJob(action).catch(() => null)
        }))

        const labels = ['Application moment', 'Reaction moment']
        components.broll = submissions
          .map((sub, i) => sub ? { taskId: sub.taskId, status: 'processing', label: labels[i] ?? `B-roll ${i + 1}` } : null)
          .filter(Boolean)

        if (ugcRow?.id) {
          await supabase.from('ugc_content')
            .update({ storage_url: JSON.stringify(components) })
            .eq('id', ugcRow.id)
        }
      }

      return NextResponse.json({
        success: true, ugcType, components, script,
        creditDeducted: totalCost, newBalance: userCredits.balance - totalCost,
      }, { status: 201 })
    }

    // image-only path falls through to single DB save
    const dbContentType = 'image'
    const dbStatus = 'completed'

    const { error: insertError } = await supabase.from('ugc_content').insert({
      user_id: userId,
      content_type: dbContentType,
      external_id: `ugc-${Date.now()}`,
      storage_url: JSON.stringify(components),
      metadata: { ugcType, productName, productDescription, benefits, callToAction, script, generatedAt: new Date().toISOString() },
      credit_cost: totalCost,
      status: dbStatus,
    })

    if (insertError) {
      console.error('DB insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save UGC package' }, { status: 500 })
    }

    await supabase.from('user_credits').update({ balance: userCredits.balance - totalCost }).eq('user_id', userId)
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
      newBalance: userCredits.balance - totalCost,
    }, { status: 201 })

  } catch (error) {
    console.error('UGC orchestration error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Generation failed' }, { status: 500 })
  }
}
