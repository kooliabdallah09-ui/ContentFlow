import { generateEmailSequence } from '@/lib/claude'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { sequenceType, product, audience, emailCount } = await request.json()

    if (!sequenceType || !product || !audience || !emailCount) {
      return NextResponse.json(
        { error: 'Missing required fields: sequenceType, product, audience, emailCount' },
        { status: 400 }
      )
    }

    const result = await generateEmailSequence(sequenceType, product, audience, emailCount)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Email generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    )
  }
}
