import { getVideoStatus } from '@/lib/heygen'
import { getBrollStatus } from '@/lib/kling'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get('videoId')
  const brollTaskIds = request.nextUrl.searchParams.get('brollTaskIds') // comma-separated

  if (!videoId && !brollTaskIds) {
    return NextResponse.json({ error: 'Missing videoId or brollTaskIds' }, { status: 400 })
  }

  try {
    const result: Record<string, unknown> = {}

    if (videoId) {
      const status = await getVideoStatus(videoId)
      result.video = status
    }

    if (brollTaskIds && (process.env.FAL_KEY || process.env.PIAPI_API_KEY)) {
      const ids = brollTaskIds.split(',').filter(Boolean)
      const statuses = await Promise.all(ids.map(id => getBrollStatus(id).catch(() => ({ status: 'failed' as const }))))
      result.broll = ids.map((id, i) => ({ taskId: id, ...statuses[i] }))
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to get status' }, { status: 500 })
  }
}
