import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { deductCredits } from '@/lib/deduct-credits'

const CREDIT_COST = 2

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
    const token = authHeader.slice(7)
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = userData.user.id

    const body = await request.json()
    const { currentContent, editRequest } = body

    if (!currentContent || !editRequest) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .maybeSingle()
    const balance = credits?.balance ?? 0
    const packCredits = credits?.pack_credits ?? 0
    if (balance < CREDIT_COST) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
    }

    const client = new Anthropic()

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `You are editing an existing piece of content. Apply ONLY the requested change — keep everything else exactly the same.

Current content:
${currentContent}

Requested change:
${editRequest}

Return ONLY the updated content. No explanation, no preamble, no quotes around it.`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')

    await deductCredits(supabase, userId, CREDIT_COST, balance, packCredits)

    await supabase.from('ugc_content').insert([{
      user_id: userId,
      content_type: 'refine',
      storage_url: null,
      metadata: { original: String(currentContent).slice(0, 500), editRequest: String(editRequest).slice(0, 500), result: content.text, source: 'refine-content', generatedAt: new Date().toISOString() },
      credit_cost: CREDIT_COST,
      status: 'completed',
    }])

    return NextResponse.json({ success: true, content: content.text, creditsUsed: CREDIT_COST })
  } catch (error) {
    console.error('Refine content error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
