import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { deductCredits } from '@/lib/deduct-credits'
import { submitSeedanceJob, generateElevenLabsViaReplicate } from '@/lib/replicate'
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

// Cost model: Seedance ~$0.30/5s, ~$0.55/10s. Nano Banana hero ~$0.05.
// ElevenLabs voice ~$0.10. At $0.03/credit sold price → 15-25 raw cost.
// Applied margin: 25cr for 5s, 45cr for 10s. +5cr if voiceover included.
function povCreditCost(durationSeconds: 5 | 10, hasVoiceover: boolean): number {
  const base = durationSeconds === 5 ? 25 : 45
  return hasVoiceover ? base + 5 : base
}

// Realistic UGC voice — same defaults as the standalone /voice generator.
const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'

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
      productName,
      productDescription,
      benefit,
      extraDirection,
      productImageBase64,
      productImageMimeType,
      uiScreenshotBase64,
      uiScreenshotMimeType,
      script,
      voiceId,
      characterDescription,
    } = body

    if (!formatId || !productName || !productDescription || !benefit) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const format = getPovFormat(formatId)
    if (!format) {
      return NextResponse.json({ error: 'Unknown format' }, { status: 400 })
    }

    if (format.needsProductImage && !productImageBase64) {
      return NextResponse.json({ error: 'This format needs a product photo' }, { status: 400 })
    }
    if (format.needsUiScreenshot && !uiScreenshotBase64) {
      return NextResponse.json({ error: 'This format needs a UI screenshot' }, { status: 400 })
    }
    if (format.needsVoiceover && (!script || !String(script).trim())) {
      return NextResponse.json({ error: 'This format needs a voiceover script' }, { status: 400 })
    }

    const totalCost = povCreditCost(format.durationSeconds, format.needsVoiceover)

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
    // For product / UI formats, build a start frame with Nano Banana so
    // Seedance keeps the packaging or app UI legible across the clip.
    let startImageUrl: string | undefined

    if (format.needsProductImage || format.needsUiScreenshot) {
      const refBase64 = format.needsProductImage ? productImageBase64 : uiScreenshotBase64
      const refMime = format.needsProductImage ? productImageMimeType : uiScreenshotMimeType

      // Hero framing prompt in the Arcads two-image style: "use this reference
      // character in this setting, with this product/UI visible."
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

    const { predictionId } = await submitSeedanceJob({
      prompt,
      durationSeconds: format.durationSeconds,
      aspectRatio: format.aspectRatio,
      startImageUrl,
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
      durationSeconds: format.durationSeconds,
      aspectRatio: format.aspectRatio,
      generatedAt: new Date().toISOString(),
    }

    const components = {
      video: {
        videoId: predictionId,
        status: 'processing',
        provider: 'seedance',
        duration: format.durationSeconds,
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
