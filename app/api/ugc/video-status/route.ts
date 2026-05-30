import { getVideoStatus } from '@/lib/heygen'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get('videoId')
  if (!videoId) return NextResponse.json({ error: 'Missing videoId' }, { status: 400 })

  try {
    const result = await getVideoStatus(videoId)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to get status' }, { status: 500 })
  }
}
