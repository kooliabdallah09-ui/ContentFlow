import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateTextToImage } from '@/lib/nanobanana'
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

    // Same portrait template as scripts/generate-actor-portraits.mjs.
    const characterPrompt = buildCharacterPrompt(profile)
    const scene = profile.scene ? `in a ${profile.scene.toLowerCase()}` : ''
    const prompt = `Hyper-realistic phone-camera portrait of ${characterPrompt} ${scene}, looking slightly off-camera, head and upper shoulders visible, soft natural lighting. Vertical 9:16 portrait framing. Should read as a real candid moment captured on a phone — no beauty filter, no studio polish.`

    const result = await generateTextToImage(prompt)

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
