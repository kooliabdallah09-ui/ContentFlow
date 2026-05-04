import { getUserContent } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const contentType = request.nextUrl.searchParams.get('type')

    const content = await getUserContent(contentType || undefined)

    return NextResponse.json(content)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Retrieval failed' },
      { status: 500 }
    )
  }
}
