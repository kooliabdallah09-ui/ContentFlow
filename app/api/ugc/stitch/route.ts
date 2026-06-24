import * as shotstack from '@/lib/shotstack'
import { NextRequest, NextResponse } from 'next/server'

// Stitch concatenates Kling clips and applies aspect ratio.
// Captions and watermark are intentionally omitted — users add them in the video editor.
export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const {
      talkingHeadUrl,
      talkingHeadDuration,
      additionalTalkingHeadUrls,
      aspect,
    } = await request.json()

    if (!talkingHeadUrl) {
      return NextResponse.json({ error: 'Missing talkingHeadUrl' }, { status: 400 })
    }

    // Captions and watermark removed — users add them in the video editor instead.
    const { renderId } = await submitStitchJob({
      talkingHeadUrl,
      talkingHeadDuration: typeof talkingHeadDuration === 'number' ? talkingHeadDuration : undefined,
      additionalTalkingHeadUrls: Array.isArray(additionalTalkingHeadUrls) ? additionalTalkingHeadUrls : undefined,
      watermark: false,
      aspect: typeof aspect === 'string' ? aspect as 'portrait' | 'square' | 'landscape' : undefined,
    })
    return NextResponse.json({ renderId })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Stitch submission failed' },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  const renderId = request.nextUrl.searchParams.get('renderId')
  if (!renderId) {
    return NextResponse.json({ error: 'Missing renderId' }, { status: 400 })
  }

  try {
    const result = await getStitchStatus(renderId)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status check failed' },
      { status: 500 },
    )
  }
}
