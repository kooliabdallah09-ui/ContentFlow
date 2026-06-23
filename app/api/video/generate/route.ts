import { submitSora2ViaReplicate } from '@/lib/replicate'
import { submitKlingV3OmniJob } from '@/lib/replicate'
import { generateTextToImage } from '@/lib/nanobanana'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export const maxDuration = 120

// Credit costs per model + duration
const COSTS: Record<string, Record<number, number>> = {
  'sora-2':   { 5: 35, 10: 60, 15: 85, 20: 110 },
  'kling-v3': { 5: 25, 10: 50, 15: 75, 20: 100 },
}

function getCost(model: string, duration: number): number {
  return COSTS[model]?.[duration] ?? 60
}

// Sora reference image: must match exact output size
const SORA_W = 720, SORA_H = 1280

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
    if (!prompt) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })

    const model = body.model === 'kling-v3' ? 'kling-v3' : 'sora-2'
    const duration = Number(body.duration ?? 10)
    const allowedDurations = Object.keys(COSTS[model]).map(Number)
    if (!allowedDurations.includes(duration)) {
      return NextResponse.json({ error: `Invalid duration for ${model}` }, { status: 400 })
    }

    const refImageBase64 = typeof body.referenceImageBase64 === 'string' ? body.referenceImageBase64 : undefined
    const refImageMimeType = typeof body.referenceImageMimeType === 'string' ? body.referenceImageMimeType : undefined

    const totalCost = getCost(model, duration)
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

    let predictionId: string
    let provider: string

    if (model === 'sora-2') {
      // Sora needs a reference image — generate one from the prompt if not provided
      let refImageBuf: Buffer
      if (refImageBase64 && refImageMimeType) {
        refImageBuf = await sharp(Buffer.from(refImageBase64, 'base64'))
          .resize(SORA_W, SORA_H, { fit: 'cover', position: 'center' })
          .png()
          .toBuffer()
      } else {
        const generated = await generateTextToImage(prompt)
        refImageBuf = await sharp(Buffer.from(generated.imageBase64, 'base64'))
          .resize(SORA_W, SORA_H, { fit: 'cover', position: 'center' })
          .png()
          .toBuffer()
      }

      const filename = `video-ref/${userId}-${Date.now()}.png`
      const { error: upErr } = await supabase.storage
        .from('ugc-assets')
        .upload(filename, refImageBuf, { contentType: 'image/png', upsert: false })
      if (upErr) return NextResponse.json({ error: `Storage upload failed: ${upErr.message}` }, { status: 500 })

      const { data: { publicUrl: referenceImageUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(filename)

      const soraJob = await submitSora2ViaReplicate({
        prompt,
        durationSeconds: duration as 5 | 10 | 15 | 20,
        aspectRatio: '9:16',
        resolution: '720p',
        referenceImageUrl,
      })
      predictionId = soraJob.predictionId
      provider = 'sora-2'
    } else {
      // Kling v3 — also needs a start image
      let startImageUrl: string
      if (refImageBase64 && refImageMimeType) {
        const buf = await sharp(Buffer.from(refImageBase64, 'base64'))
          .resize(720, 1280, { fit: 'cover', position: 'center' })
          .png()
          .toBuffer()
        const filename = `video-ref/${userId}-${Date.now()}.png`
        await supabase.storage.from('ugc-assets').upload(filename, buf, { contentType: 'image/png', upsert: false })
        const { data: { publicUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
        startImageUrl = publicUrl
      } else {
        const generated = await generateTextToImage(prompt)
        const buf = await sharp(Buffer.from(generated.imageBase64, 'base64'))
          .resize(720, 1280, { fit: 'cover', position: 'center' })
          .png()
          .toBuffer()
        const filename = `video-ref/${userId}-${Date.now()}.png`
        await supabase.storage.from('ugc-assets').upload(filename, buf, { contentType: 'image/png', upsert: false })
        const { data: { publicUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
        startImageUrl = publicUrl
      }

      const klingJob = await submitKlingV3OmniJob({
        prompt,
        startImageUrl,
        durationSeconds: Math.min(duration, 15) as 5 | 10 | 15,
        aspectRatio: '9:16',
        mode: 'standard',
      })
      predictionId = klingJob.predictionId
      provider = 'kling-v3'
    }

    // Save to library as processing, deduct credits
    const { data: contentRow } = await supabase.from('ugc_content').insert({
      user_id: userId,
      content_type: 'video',
      external_id: predictionId,
      storage_url: JSON.stringify({ video: { videoId: predictionId, status: 'processing', provider } }),
      metadata: { prompt: prompt.slice(0, 200), provider, duration, generatedAt: new Date().toISOString() },
      credit_cost: totalCost,
      status: 'processing',
    }).select('id').single()

    await supabase.from('user_credits').update({ balance: userCredits.balance - totalCost }).eq('user_id', userId)
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: totalCost,
      transaction_type: 'generation',
      content_type: 'video',
      description: `Video (${provider}) · ${duration}s · ${prompt.slice(0, 60)}`,
    })

    return NextResponse.json({
      success: true,
      predictionId,
      provider,
      duration,
      contentId: contentRow?.id ?? null,
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
