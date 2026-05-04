import { saveContent, updateContent } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { contentId, contentType, title, body, metadata } = await request.json()

    if (!contentType || !title || !body) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    let result
    if (contentId) {
      result = await updateContent(contentId, title, body, metadata)
    } else {
      result = await saveContent(contentType, title, body, metadata)
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Save failed' },
      { status: 500 }
    )
  }
}
