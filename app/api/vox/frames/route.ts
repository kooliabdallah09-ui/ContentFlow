import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { generateNanoBananaImage } from '@/lib/nanobanana'
import type { VoxBeat } from '@/lib/vox-beatmap'

export const maxDuration = 180

// Builds a Vox-style frame prompt for a single beat.
// Visual style: Vox Media YouTube explainer — 16:9 landscape, cinematic, data-driven, editorial.
function buildVoxFramePrompt(beat: VoxBeat, productName?: string, hasProductRef?: boolean): string {
  const desc = beat.visual_description
  const color = beat.accent_color

  const productSuffix = hasProductRef
    ? ` The reference image shows the exact product — preserve its label, packaging, and colours faithfully.`
    : productName
    ? ` Context: the topic is about "${productName}".`
    : ''

  // Detect the visual format tag the beat map specified
  const isInfographic = /^INFOGRAPHIC:/i.test(desc)
  const isMap = /^MAP:/i.test(desc)
  const isBroll = /^B-ROLL:/i.test(desc)
  const cleanDesc = desc.replace(/^(PHOTO|INFOGRAPHIC|MAP|B-ROLL|DOCUMENTARY):\s*/i, '')

  let styleDirective: string
  if (isInfographic) {
    styleDirective = `Bold flat infographic illustration. ${cleanDesc}. Dominant accent color ${color} used for key elements. Clean sans-serif data visualization aesthetic — bar charts, icons, or stat typography rendered as graphic art. White or very dark background for contrast. No photographic elements.`
  } else if (isMap) {
    styleDirective = `Bold editorial map illustration. ${cleanDesc}. Solid fills, high-contrast color coding, accent ${color} highlights the key region. Flat design, crisp outlines. Vox-style geographic visualization. No labels or text overlays.`
  } else if (isBroll) {
    styleDirective = `Cinematic 16:9 documentary B-roll photograph. ${cleanDesc}. ${color} accent color reflected subtly in lighting or environmental color. Wide establishing shot or dramatic close-up. High contrast, photojournalistic realism. Shot on professional cinema camera.`
  } else {
    // PHOTO or untagged — photojournalism
    styleDirective = `Cinematic 16:9 editorial photograph. ${cleanDesc}. Photojournalistic style — dramatic real-world lighting, authentic subject matter. ${color} color accent woven into the scene (a colored surface, lighting gel, or environmental element). Shot on professional camera with a 35mm or 85mm lens. High contrast, film-grade colour grade.`
  }

  return `${styleDirective}${productSuffix} 16:9 landscape frame. No text overlays, no watermarks, no captions, no subtitles. Vox Media explainer video visual style.`
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
