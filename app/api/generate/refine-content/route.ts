import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { currentContent, editRequest } = body

    if (!currentContent || !editRequest) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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

    return NextResponse.json({ success: true, content: content.text })
  } catch (error) {
    console.error('Refine content error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
