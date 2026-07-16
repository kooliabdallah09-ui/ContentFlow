import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { generateCharacterWithProduct, generateTextToImage } from '@/lib/nanobanana'
import type { CharacterProfile } from '@/lib/character'
import { buildCharacterPrompt as buildCharacterImagePrompt } from '@/lib/ugc-character-prompt'
import { inferProductCategory } from '@/lib/multi-shot'

export const maxDuration = 180

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
    } = body as Record<string, unknown>

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
      })
      characterIdea = built.characterIdea
      imagePrompt = built.imagePrompt
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
          '',                 // scene is baked into imagePrompt
          undefined,          // no legacy custom-instructions inject
          aspect.nanoBananaRatio,
          undefined,          // no actor portrait — Nano Banana Pro generates fresh
          undefined,
        )
        return { base64: f.imageBase64, mimeType: f.mimeType }
      }
      // No product — text-only from the Sonnet image prompt.
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
