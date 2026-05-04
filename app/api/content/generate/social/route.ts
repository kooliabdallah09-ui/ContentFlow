import { generateSocialContent } from '@/lib/claude'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { topic, platforms } = await request.json()

    if (!topic || !platforms || platforms.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: topic, platforms' },
        { status: 400 }
      )
    }

    const result = await generateSocialContent(topic, platforms)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Social generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    )
  }
}
