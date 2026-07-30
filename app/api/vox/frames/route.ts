import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { generateNanoBananaImage } from '@/lib/nanobanana'
import type { VoxBeat } from '@/lib/vox-beatmap'

export const maxDuration = 180

// Builds a Vox-style frame prompt for a single beat.
// Real Vox style: single clean scene, bold flat colors, minimal, editorial.
function buildVoxFramePrompt(beat: VoxBeat, productName?: string, hasProductRef?: boolean): string {
  const desc = beat.visual_description
  const color = beat.accent_color

  const productSuffix = hasProductRef
    ? ` The reference image shows the exact product — preserve its packaging, label, and colours faithfully.`
    : ''

  const isInfographic = /^INFOGRAPHIC:/i.test(desc)
  const isMap = /^MAP:/i.test(desc)
  const isBroll = /^B-ROLL:/i.test(desc)
  const cleanDesc = desc.replace(/^(PHOTO|INFOGRAPHIC|MAP|B-ROLL|DOCUMENTARY):\s*/i, '').trim()

  let styleDirective: string

  if (isMap) {
    styleDirective = [
      `Flat vector-style map illustration, single unified scene filling the entire 16:9 frame.`,
      cleanDesc,
      `Bold solid color fills — accent color ${color} highlights the key region. Minimal detail, crisp clean outlines, Vox Media editorial map aesthetic.`,
      `Lots of negative space. Very simple and clean. NOT a collage.`,
    ].join(' ')
  } else if (isInfographic) {
    styleDirective = [
      `Clean minimal data visualization poster, single graphic filling the entire 16:9 frame.`,
      cleanDesc,
      `ONE simple chart or bold statistic. Dominant accent color ${color}. Very generous white or near-black negative space.`,
      `Maximum 5 visual elements. No clutter. Inspired by Vox Media explainer graphics — bold, simple, immediately readable.`,
      `NOT a collage, NOT a grid of multiple charts. Single focused graphic.`,
    ].join(' ')
  } else if (isBroll) {
    styleDirective = [
      `Single wide cinematic shot, one continuous scene filling the entire 16:9 frame.`,
      cleanDesc,
      `Shot on professional cinema camera. Shallow depth of field, rich film color grade. Accent color ${color} present in the environment or lighting.`,
      `ONE establishing shot — no split screen, no collage, no grid. Single unified image.`,
    ].join(' ')
  } else {
    // PHOTO — editorial photojournalism
    styleDirective = [
      `Single editorial photograph filling the entire 16:9 frame, one unified scene.`,
      cleanDesc,
      `Photojournalistic style. Dramatic real-world lighting. Professional 35mm lens.`,
      `Accent color ${color} subtly present in scene (clothing, environment, or light). High contrast, film-grade colour grade.`,
      `ONE complete photograph — absolutely no split-screen, no collage, no tiled images, no grid of photos.`,
    ].join(' ')
  }

  const suffix = [
    productSuffix,
    `16:9 landscape orientation.`,
    `CRITICAL: Single unified image. No split screen. No photo grid. No collage. No tiled panels.`,
    `No text overlays. No watermarks. No captions. No UI elements.`,
    `Style reference: Vox Media YouTube video frame.`,
  ].filter(Boolean).join(' ')

  return `${styleDirective} ${suffix}`
}

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
    const beats = body.beats as VoxBeat[]
    const productImageBase64 = typeof body.productImageBase64 === 'string' ? body.productImageBase64 : undefined
    const productImageMimeType = typeof body.productImageMimeType === 'string' ? body.productImageMimeType : undefined
    const productName = typeof body.productName === 'string' ? body.productName.trim() : undefined
    const aspectId = typeof body.aspectId === 'string' ? body.aspectId : 'landscape'

    if (!Array.isArray(beats) || beats.length === 0) {
      return NextResponse.json({ error: 'beats array is required' }, { status: 400 })
    }

    const { getAspect } = await import('@/lib/aspects')
    const aspect = getAspect(aspectId)

    const hasProductRef = !!(productImageBase64 && productImageMimeType)
    const refStack: Array<{ base64: string; mimeType: string }> = hasProductRef
      ? [{ base64: productImageBase64!, mimeType: productImageMimeType! }]
      : []
    const productHint = hasProductRef
      ? `The reference image is the EXACT product — preserve its packaging, label, colours, and shape faithfully.`
      : undefined

    const stamp = Date.now()

    // Fan-out: generate one frame per beat in parallel
    const settled = await Promise.allSettled(
      beats.map(async (beat, i) => {
        const prompt = buildVoxFramePrompt(beat, productName, hasProductRef)
        const result = await generateNanoBananaImage(prompt, {
          style: 'professional',
          ratio: aspect.nanoBananaRatio === '1:1' ? '1:1' : aspect.nanoBananaRatio === '16:9' ? '16:9' : '9:16',
          referenceImages: refStack.length ? refStack : undefined,
          referenceHint: refStack.length ? productHint : undefined,
        })
        // Resize to target dimensions
        const resized = await sharp(Buffer.from(result.imageBase64, 'base64'))
          .resize(aspect.width, aspect.height, { fit: 'cover', position: 'center' })
          .png()
          .toBuffer()

        const filename = `vox-frames/${userId}-${stamp}-${i}.png`
        const { error: upErr } = await supabase.storage
          .from('ugc-assets')
          .upload(filename, resized, { contentType: 'image/png', upsert: false })
        if (upErr) throw new Error(`Upload failed for beat ${i}: ${upErr.message}`)

        const { data: pub } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
        return pub.publicUrl
      }),
    )

    const frameUrls: (string | null)[] = settled.map(r =>
      r.status === 'fulfilled' ? r.value : null,
    )

    const successCount = frameUrls.filter(Boolean).length
    if (successCount === 0) {
      const firstErr = settled.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined
      throw new Error(firstErr?.reason?.message ?? 'All frame generations failed')
    }

    return NextResponse.json({ frameUrls })
  } catch (err) {
    console.error('[vox/frames] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Frame generation failed' },
      { status: 500 },
    )
  }
}
