import { submitSoraJob } from '@/lib/sora'
import { generateTextToImage } from '@/lib/nanobanana'
import {
  DURATION_OPTIONS,
  DURATION_CONFIGS,
  DEFAULT_DURATION,
  calculateStandaloneVideoCredits,
  type UGCDuration,
} from '@/lib/tiers'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export const maxDuration = 60

// Sora 2 expects 720x1280 portrait for our 9:16 output. Reference images that
// come in any aspect ratio get cover-cropped to this exact size before upload.
const SORA_W = 720
const SORA_H = 1280
const SORA_SIZE = `${SORA_W}x${SORA_H}`

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
    const prompt = typeof body.prompt === 'string' ? body.prompt.slice(0, 4000).trim() : ''
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    // Validate duration against available native ones (4/8/12). Extended/chained
    // share the same Sora call shape but only the soraSeconds value matters here.
    const rawDuration = Number(body.duration ?? DEFAULT_DURATION)
    const allowedDurations: readonly number[] = DURATION_OPTIONS
    const dCfg = allowedDurations.includes(rawDuration) ? DURATION_CONFIGS[rawDuration] : null
    if (!dCfg?.available) {
      return NextResponse.json({ error: 'Selected duration is not available yet' }, { status: 400 })
    }
    const duration: UGCDuration = rawDuration as UGCDuration

    // Optional reference image as base64. If provided, we resize to Sora's exact
    // dimensions, upload to Supabase, and pass the public URL to Sora as input_reference.
    const refImageBase64 = typeof body.referenceImageBase64 === 'string' ? body.referenceImageBase64 : undefined
    const refImageMimeType = typeof body.referenceImageMimeType === 'string' ? body.referenceImageMimeType : undefined

    // Credit check before any paid call.
    const totalCost = calculateStandaloneVideoCredits(duration)
    const { data: userCredits } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', userId)
      .single()
    if (!userCredits || userCredits.balance < totalCost) {
      return NextResponse.json(
        { error: `Insufficient credits. Need ${totalCost}, have ${userCredits?.balance ?? 0}` },
        { status: 400 },
      )
    }

    // Sora 2 base model REQUIRES input_reference. We either use the user's uploaded
    // reference (resized to Sora's exact dimensions) OR generate one from the prompt
    // via Nano Banana 2 text-to-image. Either way, end up with a public Supabase URL.
    let referenceImageBuf: Buffer
    try {
      if (refImageBase64 && refImageMimeType) {
        referenceImageBuf = await sharp(Buffer.from(refImageBase64, 'base64'))
          .resize(SORA_W, SORA_H, { fit: 'cover', position: 'center' })
          .png()
          .toBuffer()
      } else {
        // Auto-generate a first frame from the prompt — adds ~$0.12 to cost
        // but the credit math already covers it via BASE_STANDALONE_VIDEO.
        const generated = await generateTextToImage(prompt)
        referenceImageBuf = await sharp(Buffer.from(generated.imageBase64, 'base64'))
          .resize(SORA_W, SORA_H, { fit: 'cover', position: 'center' })
          .png()
          .toBuffer()
      }
    } catch (err) {
      return NextResponse.json(
        { error: `Failed to prepare first frame: ${err instanceof Error ? err.message : 'unknown'}` },
        { status: 500 },
      )
    }

    const filename = `video-ref/${userId}-${Date.now()}.png`
    const { error: upErr } = await supabase.storage
      .from('ugc-assets')
      .upload(filename, referenceImageBuf, { contentType: 'image/png', upsert: false })
    if (upErr) {
      return NextResponse.json({ error: `Storage upload failed: ${upErr.message}` }, { status: 500 })
    }
    const { data: { publicUrl: referenceImageUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(filename)

    // Standalone video page is still on Sora 2 (only the UGC pipeline migrated to Kling).
    // Map the new Kling duration buckets to Sora's native 4/8/12s slots.
    const klingSec = dCfg.klingSeconds
    const soraSeconds: 4 | 8 | 12 = klingSec <= 5 ? 4 : klingSec <= 10 ? 8 : 12
    const { videoId } = await submitSoraJob({
      prompt,
      referenceImageUrl,
      durationSeconds: soraSeconds,
      size: SORA_SIZE,
    })

    // Save DB row + deduct credits BEFORE returning so the videoId is never lost
    // even if Vercel's 300s edge timeout fires after this returns.
    const components = {
      video: {
        videoId,
        status: 'processing',
        provider: 'sora-2',
        duration,
        estimatedDuration: duration,
      },
      prompt,
    }
    const externalId = `video-${Date.now()}`
    const { data: row } = await supabase.from('ugc_content').insert({
      user_id: userId,
      content_type: 'video',
      external_id: externalId,
      storage_url: JSON.stringify(components),
      metadata: { prompt, duration, generatedAt: new Date().toISOString() },
      credit_cost: totalCost,
      status: 'generating',
    }).select('id').single()

    await supabase.from('user_credits').update({ balance: userCredits.balance - totalCost }).eq('user_id', userId)
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: totalCost,
      transaction_type: 'generation',
      content_type: 'video',
      description: `Video: ${prompt.slice(0, 60)}`,
    })

    return NextResponse.json({
      success: true,
      id: row?.id,
      components,
      creditDeducted: totalCost,
      newBalance: userCredits.balance - totalCost,
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Video generation failed' },
      { status: 500 },
    )
  }
}
