import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { buildBeatMapPrompt, type VoxBeatMap } from '@/lib/vox-beatmap'

export const maxDuration = 60

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

    const body = await request.json()
    const topic = typeof body.topic === 'string' ? body.topic.trim() : ''
    const tone = typeof body.tone === 'string' ? body.tone.trim() : 'informative'
    const targetDuration = typeof body.targetDuration === 'number' ? body.targetDuration : 30

    if (!topic) {
      return NextResponse.json({ error: 'topic is required' }, { status: 400 })
    }
    const validTones = ['informative', 'energetic', 'documentary']
    const safeTone = validTones.includes(tone) ? tone : 'informative'
    const safeDuration = [30, 45, 60].includes(targetDuration) ? targetDuration : 30

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const prompt = buildBeatMapPrompt(topic, safeTone, safeDuration)

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (msg.content[0] as { text: string }).text.trim()

    // Strip markdown code fences if model wraps output
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    let beatMap: VoxBeatMap
    try {
      beatMap = JSON.parse(jsonStr) as VoxBeatMap
    } catch {
      console.error('[vox/beat-map] JSON parse failed. Raw output:', raw.slice(0, 500))
      return NextResponse.json({ error: 'Beat map generation failed — invalid JSON from model' }, { status: 500 })
    }

    // Basic validation
    if (!beatMap.beats || !Array.isArray(beatMap.beats) || beatMap.beats.length === 0) {
      return NextResponse.json({ error: 'Beat map has no beats' }, { status: 500 })
    }

    return NextResponse.json({ beatMap })
  } catch (err) {
    console.error('[vox/beat-map] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Beat map generation failed' },
      { status: 500 },
    )
  }
}
