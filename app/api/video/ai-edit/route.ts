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
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `You are a video editor assistant. The user has a video with this current edit spec:

${JSON.stringify(spec, null, 2)}

The user wants to make this change: "${instruction}"

Return ONLY a valid JSON object — the updated EditSpec. No explanation, no markdown, no code fences. Start your response with { and end with }.

EditSpec shape:
{
  "videoUrl": string,
  "duration": number,
  "trimStart": number,
  "trimEnd": number,
  "overlays": [{ "id": string, "text": string, "start": number, "duration": number, "position": "top"|"center"|"bottom", "style": "bold-white"|"minimal"|"caption", "x": number (0-1), "y": number (0-1) }],
  "music": null | { "url": string, "label": string, "volume": number },
  "aspectRatio": "9:16"|"1:1"|"16:9"
}

Rules:
- trimStart and trimEnd must be between 0 and duration
- overlay ids must be unique short strings
- x and y are 0–1 where 0.5 is center; y=0.1 is near top, y=0.85 is near bottom
- For "make a caption" or "add caption/text": add an overlay with the text centered
- For "cut the last Ns": set trimEnd = duration - N
- Available music tracks: Chill Lo-fi (https://cdn.pixabay.com/download/audio/2022/03/10/audio_270f42fe9d.mp3), Upbeat Pop (https://cdn.pixabay.com/download/audio/2023/06/08/audio_58c1e76847.mp3), Motivational (https://cdn.pixabay.com/download/audio/2022/10/25/audio_943d4f9d08.mp3)`,
      }],
    })

    const raw = (msg.content[0] as { text: string }).text.trim()
    // Strip any accidental markdown code fences
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    let newSpec: EditSpec
    try {
      newSpec = JSON.parse(text)
    } catch {
      console.error('[ai-edit] Invalid JSON from Claude:', raw)
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
