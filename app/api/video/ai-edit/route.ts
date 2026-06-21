import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { EditSpec } from '@/lib/edit-spec'

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

    const body = await request.json()
    const spec: EditSpec = body.spec
    const instruction: string = body.instruction ?? ''

    if (!spec || !instruction.trim()) {
      return NextResponse.json({ error: 'Missing spec or instruction' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are a video editor assistant. The user has a video with this current edit spec:

${JSON.stringify(spec, null, 2)}

The user wants to make this change: "${instruction}"

Return ONLY a valid JSON object that is the updated EditSpec with the changes applied. Do not explain. Do not wrap in markdown. Just the raw JSON object.

Rules:
- trimStart and trimEnd must be between 0 and spec.duration
- overlay ids must be unique strings (use short random strings if adding new ones)
- music must be null or { url, label, volume } where volume is 0-1
- position must be 'top', 'center', or 'bottom'
- style must be 'bold-white', 'minimal', or 'caption'`,
      }],
    })

    const text = (msg.content[0] as { text: string }).text.trim()
    let newSpec: EditSpec
    try {
      newSpec = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 })
    }

    // Sanitize
    if (typeof newSpec.trimStart !== 'number') newSpec.trimStart = spec.trimStart
    if (typeof newSpec.trimEnd !== 'number') newSpec.trimEnd = spec.trimEnd
    if (!Array.isArray(newSpec.overlays)) newSpec.overlays = spec.overlays
    newSpec.videoUrl = spec.videoUrl
    newSpec.duration = spec.duration

    return NextResponse.json({ spec: newSpec })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
