import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { generateCharacterWithProduct, ugcifyPortrait, generateCharacterInFrontOfUI } from '@/lib/nanobanana'
import { buildCharacterPrompt, type CharacterProfile } from '@/lib/character'

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
      productType,
      character: characterFromForm,
      avatarGender,
      actorId,
      customPhotoBase64,
      customPhotoMimeType,
      aspectId,
      customInstructions,
      script,
    } = body as Record<string, unknown>

    // Resolve aspect for output dimensions.
    const { getAspect } = await import('@/lib/aspects')
    const aspect = getAspect(typeof aspectId === 'string' ? aspectId : undefined)

    const safeProductName = String(productName || 'the topic').trim() || 'the topic'
    const safeProductDescription = String(productDescription || 'general talking-head content').trim() || 'general talking-head content'
    const safeCustomInstructions = typeof customInstructions === 'string'
      ? customInstructions.slice(0, 1500).trim() || undefined
      : undefined

    // Load the actor portrait if a library actor is chosen; else use custom photo.
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
      } catch { /* fall through */ }
    } else if (typeof customPhotoBase64 === 'string' && typeof customPhotoMimeType === 'string') {
      actorPortraitBase64 = customPhotoBase64
      actorPortraitMimeType = customPhotoMimeType
    }

    const hasProduct = !!(productImageBase64 && productImageMimeType)
    const hasActorPhoto = !!(actorPortraitBase64 && actorPortraitMimeType)

    if (!hasProduct && !hasActorPhoto) {
      return NextResponse.json(
        { error: 'Please provide a product photo or pick an actor / upload your own photo.' },
        { status: 400 },
      )
    }

    const character = characterFromForm as CharacterProfile | undefined
    const characterPrompt = character && character.gender
      ? buildCharacterPrompt(character)
      : avatarGender === 'Male'
        ? 'late 20s man, candid expression, real skin texture with pores and slight imperfections, natural hair with flyaways, casual outfit appropriate to the scene'
        : 'late 20s woman, candid expression, real skin texture with pores and slight imperfections, natural hair with flyaways, casual outfit appropriate to the scene'

    // Scene: prefer the character's own scene override; otherwise pull the
    // [BACKGROUND: ...] hint out of the script.
    const bgMatch = typeof script === 'string' ? script.match(/\[BACKGROUND:\s*([^\]]+)\]/i) : null
    const backgroundContext = bgMatch?.[1]?.trim() ?? 'casual indoor setting'
    const heroScene = character?.scene?.trim() ? character.scene.toLowerCase() : backgroundContext

    // Generate one hero frame. This mirrors the branch logic in orchestrate.
    async function generateOne(): Promise<{ base64: string; mimeType: string }> {
      if (hasProduct && productType === 'software') {
        const f = await generateCharacterInFrontOfUI(
          productImageBase64 as string,
          productImageMimeType as string,
          characterPrompt,
          aspect.nanoBananaRatio,
          actorPortraitBase64,
          actorPortraitMimeType,
        )
        return { base64: f.imageBase64, mimeType: f.mimeType }
      }
      if (hasProduct) {
        const f = await generateCharacterWithProduct(
          productImageBase64 as string,
          productImageMimeType as string,
          safeProductName,
          characterPrompt,
          heroScene,
          safeCustomInstructions,
          aspect.nanoBananaRatio,
          actorPortraitBase64,
          actorPortraitMimeType,
        )
        return { base64: f.imageBase64, mimeType: f.mimeType }
      }
      // No product path — ugcify the portrait into the scene.
      const f = await ugcifyPortrait(
        actorPortraitBase64 as string,
        actorPortraitMimeType as string,
        heroScene,
        characterPrompt,
        aspect.nanoBananaRatio,
      )
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

    return NextResponse.json({ frames })
  } catch (err) {
    console.error('ugc/hero-frames error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Hero frame generation failed' },
      { status: 500 },
    )
  }
}
