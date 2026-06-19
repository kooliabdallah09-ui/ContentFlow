import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateNanoBananaImage } from '@/lib/nanobanana'
import { buildCharacterPrompt, type CharacterProfile } from '@/lib/character'

// Admin-only — generates a single actor portrait via Nano Banana Pro for the
// /admin/actors studio page. Auth-gated to any logged-in user (this is a
// local-tooling helper, not a public endpoint). Returns base64 + a portrait
// prompt preview so the UI can show what was sent to the model.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: userData, error } = await supabase.auth.getUser(authHeader.slice(7))
    if (error || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const profile = body.profile as CharacterProfile | undefined
    if (!profile) {
      return NextResponse.json({ error: 'Missing profile' }, { status: 400 })
    }

    const characterPrompt = buildCharacterPrompt(profile)
    const sceneClause = profile.scene
      ? `Setting: a lived-in ${profile.scene.toLowerCase()} with visible depth and personality — plants, framed art, soft textiles, decor items, a glimpse of furniture, warm color accents. The background must NOT be a blank wall — it should feel like a real person's home, full of character and softly blurred (shallow depth of field).`
      : `Setting: a warm, lived-in indoor space with visible decor, plants, and personality in soft background blur.`
    const prompt = `Hyper-realistic UGC selfie portrait of ${characterPrompt}.

${sceneClause}

Framing: vertical 9:16 phone portrait, shot from arm's length like a creator filming themselves. Head and upper torso fully visible from the top of the hair down to the collarbone/chest — DO NOT crop the top of the head or the shoulders. Subject fills roughly the middle 60% of the frame with breathing room above the head.

Lighting: soft natural window light from the side, warm golden tone, gently flattering on the face. Avoid harsh shadows.

Quality: photorealistic phone camera output, real skin texture with pores preserved, natural micro-imperfections, no beauty filter, no studio polish, no plastic skin. Should look like a real Instagram creator's selfie — confident, warm, magnetic, looking the viewer in the eye.`

    // Use the generic image generator so we can lock the aspect ratio to 9:16 —
    // generateTextToImage hardcoded this, but going through the generic path
    // makes the ratio explicit alongside the other portrait params.
    const result = await generateNanoBananaImage(prompt, { ratio: '9:16', style: 'realistic' })

    return NextResponse.json({
      imageBase64: result.imageBase64,
      mimeType: result.mimeType,
      prompt,
    })
  } catch (err) {
    console.error('actor-portrait error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 },
    )
  }
}
