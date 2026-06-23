import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const maxDuration = 30

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: userData, error } = await supabase.auth.getUser(authHeader.slice(7))
  if (error || !userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { currentScript, instruction, productName, productDescription, benefits, callToAction } = await request.json()
  if (!currentScript || !instruction) {
    return NextResponse.json({ error: 'Missing currentScript or instruction' }, { status: 400 })
  }

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: `You are editing a UGC video ad script. Apply the user's requested change and return ONLY the revised script — no commentary, no explanation, no markdown.

Product: ${productName ?? ''}
Description: ${productDescription ?? ''}
Benefits: ${benefits ?? ''}
CTA: ${callToAction ?? ''}

CURRENT SCRIPT:
${currentScript}

USER'S REQUESTED CHANGE:
${instruction}

Return only the revised script text, preserving the same format (HOOK / BODY / CTA sections if present).`,
    }],
  })

  const revised = (msg.content[0] as { text: string }).text.trim()
  return NextResponse.json({ script: revised })
}
