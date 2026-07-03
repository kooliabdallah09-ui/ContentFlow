import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { deductCredits } from '@/lib/deduct-credits'
import { submitKlingV3OmniJob, generateElevenLabsViaReplicate } from '@/lib/replicate'
import { generateNanoBananaImage } from '@/lib/nanobanana'
import { getPovFormat } from '@/lib/pov-formats'
import { buildPovSeedancePrompt, buildHeroFramePrompt } from '@/lib/pov-prompt'

// POV / faceless ad generator.
// Pipeline:
//   1. Auth + credit check
//   2. If format needs a product/UI reference, we build a hero frame with
//      Nano Banana (composites the product or UI screenshot into the
//      chosen scene) — Seedance uses this as `start_image` for consistency.
//   3. Submit Seedance job (async, we return prediction id)
//   4. If format needs voiceover, run ElevenLabs on the user's script,
//      upload the mp3, and stash the URL in the DB row's metadata so the
//      player can play video + audio in sync.
//   5. Save to ugc_content, deduct credits, return.

export const maxDuration = 300

// Cost model (Seedance 2.0 non_video_in 720p — $0.18/s of output):
//   5s clip = $0.90 Seedance + $0.05 Nano Banana + $0.10 ElevenLabs = ~$1.05 raw
//   10s clip = $1.80 Seedance + $0.05 Nano Banana + $0.10 ElevenLabs = ~$1.95 raw
// At $0.03 per credit sold price, price at 60cr / 110cr keeps a healthy margin.
function povCreditCost(durationSeconds: 5 | 10, hasVoiceover: boolean): number {
  const base = durationSeconds === 5 ? 60 : 110
  return hasVoiceover ? base : base - 5
}

// Realistic UGC voice — same defaults as the standalone /voice generator.
const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'

// Belt-and-braces guard: strip profanity, nudity, and minor references.
// Kling v3 is much more permissive than Seedance so bedroom/night are fine.
const RISKY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\b(undressed|underwear|lingerie|naked|nude|topless|bare skin|sensual|sexy)\b/gi, 'casual'],
  [/\b(fucking|shit|damn|asshole|bitch)\b/gi, ''],
  [/\b(minor|underage|teen|teenage|teenager|kid)\b/gi, 'adult'],
]

function sanitize(text: string | undefined | null): string | undefined {
  if (!text) return undefined
  let out = text
  for (const [re, sub] of RISKY_REPLACEMENTS) out = out.replace(re, sub)
  return out.replace(/\s{2,}/g, ' ').trim() || undefined
}

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
      formatId,
      productImageBase64,
      productImageMimeType,
      uiScreenshotBase64,
      uiScreenshotMimeType,
      voiceId,
      duration: overrideDuration,
    } = body

    // Sanitize every free-text field to keep Seedance's content filter (E005)
    // from tripping on words like "bedroom", "1am", "dim", or profanity.
    const productName = sanitize(body.productName) ?? ''
    const productDescription = sanitize(body.productDescription) ?? ''
    const benefit = sanitize(body.benefit) ?? ''
    const extraDirection = sanitize(body.extraDirection)
    const script = sanitize(body.script)
    const characterDescription = sanitize(body.characterDescription)

    if (!formatId || !productName || !productDescription || !benefit) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const format = getPovFormat(formatId)
    if (!format) {
      return NextResponse.json({ error: 'Unknown format' }, { status: 400 })
    }

    // Duration can be overridden by the user (5 or 10s). Falls back to format default.
    const requestedDuration = Number(overrideDuration)
    const durationSeconds: 5 | 10 =
      requestedDuration === 5 || requestedDuration === 10
        ? (requestedDuration as 5 | 10)
        : format.durationSeconds

    if (format.needsProductImage && !productImageBase64) {
      return NextResponse.json({ error: 'This format needs a product photo' }, { status: 400 })
    }
    if (format.needsUiScreenshot && !uiScreenshotBase64) {
      return NextResponse.json({ error: 'This format needs a UI screenshot' }, { status: 400 })
    }
    if (format.needsVoiceover && (!script || !String(script).trim())) {
      return NextResponse.json({ error: 'This format needs a voiceover script' }, { status: 400 })
    }

    const totalCost = povCreditCost(durationSeconds, format.needsVoiceover)

    const { data: userCredits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .maybeSingle()
    const balance = userCredits?.balance ?? 0
    const packCredits = userCredits?.pack_credits ?? 0
    if (balance < totalCost) {
      return NextResponse.json(
        { error: `Insufficient credits. Need ${totalCost}, have ${balance}` },
        { status: 402 }
      )
    }

    // === 1. Hero frame ===
    // Kling v3 omni is image-to-video, so we always need a start frame.
    // If the format takes a product photo or UI screenshot, we composite it
    // with the character. Otherwise Nano Banana renders a character-only frame.
    let startImageUrl: string
    {
      const refBase64 = format.needsProductImage ? productImageBase64 : format.needsUiScreenshot ? uiScreenshotBase64 : undefined
      const refMime = format.needsProductImage ? productImageMimeType : format.needsUiScreenshot ? uiScreenshotMimeType : undefined

      // Hero framing prompt in the Arcads two-image style.
      const heroPrompt = buildHeroFramePrompt({
        format,
        productName,
        productDescription,
        benefit,
        script: script ?? '',
        characterDescription: characterDescription ?? '',
        extraDirection: extraDirection ?? undefined,
      })

      const heroImage = await generateNanoBananaImage(heroPrompt, {
        style: 'realistic',
        ratio: format.aspectRatio,
        referenceImageBase64: refBase64,
        referenceImageMimeType: refMime,
      })

      const dims =
        format.aspectRatio === '9:16' ? { w: 720, h: 1280 } :
        format.aspectRatio === '16:9' ? { w: 1280, h: 720 } :
                                         { w: 1024, h: 1024 }

      const resized = await sharp(Buffer.from(heroImage.imageBase64, 'base64'))
        .resize(dims.w, dims.h, { fit: 'cover', position: 'center' })
        .png()
        .toBuffer()

      const filename = `pov-source/${userId}-${Date.now()}.png`
      const { error: upErr } = await supabase.storage
        .from('ugc-assets')
        .upload(filename, resized, { contentType: 'image/png', upsert: false })
      if (upErr) throw new Error(`Hero frame upload failed: ${upErr.message}`)

      const { data: pub } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
      startImageUrl = pub.publicUrl
    }

    // === 2. Seedance submission ===
    // Claude composes a bespoke Arcads-style cinematic prompt: timestamped opener,
    // dialog inline in single quotes, camera moves tied to spoken keywords,
    // handheld phone aesthetic. Falls back to the format's own template if Claude
    // errors out — Seedance still gets a usable prompt.
    let prompt: string
    try {
      prompt = await buildPovSeedancePrompt({
        format,
        productName,
        productDescription,
        benefit,
        script: script ?? '',
        characterDescription: characterDescription ?? '',
        extraDirection: extraDirection ?? undefined,
      })
    } catch (err) {
      console.error('POV Claude prompt build failed, falling back to template:', err)
      prompt = format.buildPrompt({ productName, productDescription, benefit, extraDirection: extraDirection ?? undefined })
    }

    // Belt-and-braces sanitize the composed prompt too — if Claude echoed any
    // risky phrase from the user's fields into the final prompt, strip it.
    prompt = sanitize(prompt) ?? prompt

    // Kling v3 omni is proven for character-consistent POV UGC (same model as
    // UGC Package). Native audio disabled — ElevenLabs overlay owns the voice.
    const { predictionId } = await submitKlingV3OmniJob({
      prompt,
      startImageUrl,
      durationSeconds: durationSeconds === 5 ? 5 : 10,
      aspectRatio: format.aspectRatio,
      mode: 'standard',
      generateAudio: false,
    })

    // === 3. Voiceover (fire and forget in parallel) ===
    // Generate the mp3, upload to storage, store URL in metadata.
    // Runs in parallel with the Seedance job to save wall time.
    let voiceoverUrl: string | undefined
    if (format.needsVoiceover && script) {
      try {
        const mp3 = await generateElevenLabsViaReplicate(
          String(script).trim(),
          typeof voiceId === 'string' ? voiceId : DEFAULT_VOICE_ID,
        )
        const audioFilename = `pov-audio/${userId}-${Date.now()}.mp3`
        const { error: audioErr } = await supabase.storage
          .from('ugc-assets')
          .upload(audioFilename, mp3, { contentType: 'audio/mpeg', upsert: false })
        if (!audioErr) {
          const { data: pub } = supabase.storage.from('ugc-assets').getPublicUrl(audioFilename)
          voiceoverUrl = pub.publicUrl
        }
      } catch (err) {
        console.error('POV voiceover failed (non-fatal):', err)
      }
    }

    // === 4. Persist + deduct ===
    const metadata = {
      formatId,
      formatName: format.name,
      productName,
      productDescription,
      benefit,
      extraDirection: extraDirection ?? null,
      script: script ?? null,
      characterDescription: characterDescription ?? null,
      seedancePrompt: prompt,
      voiceoverUrl: voiceoverUrl ?? null,
      startImageUrl: startImageUrl ?? null,
      durationSeconds,
      aspectRatio: format.aspectRatio,
      generatedAt: new Date().toISOString(),
    }

    const components = {
      video: {
        videoId: predictionId,
        status: 'processing',
        provider: 'kling-v3-omni',
        duration: durationSeconds,
        voiceoverUrl,
      },
    }

    await supabase.from('ugc_content').insert({
      user_id: userId,
      content_type: 'pov',
      external_id: `pov-${Date.now()}`,
      storage_url: JSON.stringify(components),
      metadata,
      credit_cost: totalCost,
      status: 'generating',
    })

    const { newBalance } = await deductCredits(supabase, userId, totalCost, balance, packCredits)
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: totalCost,
      transaction_type: 'generation',
      content_type: 'pov',
      description: `POV ${format.name}: ${productName}`,
    })

    return NextResponse.json(
      {
        success: true,
        formatId,
        components,
        creditDeducted: totalCost,
        newBalance,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('POV orchestration error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 },
    )
  }
}
