import * as creatomate from '@/lib/creatomate'
import * as shotstack from '@/lib/shotstack'
import { NextRequest, NextResponse } from 'next/server'

// Dispatch: Shotstack is preferred when its key is present (cheaper + free tier).
// Falls back to Creatomate. Render IDs are prefixed so polling routes to the right
// provider regardless of which one created the render.
const SHOTSTACK_PREFIX = 'shotstack:'

function provider() {
  return process.env.SHOTSTACK_API_KEY ? 'shotstack' : 'creatomate'
}

async function submitStitchJob(input: Parameters<typeof creatomate.submitStitchJob>[0]) {
  if (provider() === 'shotstack') {
    const { renderId } = await shotstack.submitStitchJob(input)
    return { renderId: `${SHOTSTACK_PREFIX}${renderId}` }
  }
  return creatomate.submitStitchJob(input)
}

async function getStitchStatus(renderId: string) {
  if (renderId.startsWith(SHOTSTACK_PREFIX)) {
    return shotstack.getStitchStatus(renderId.slice(SHOTSTACK_PREFIX.length))
  }
  return creatomate.getStitchStatus(renderId)
}

export async function POST(request: NextRequest) {
  try {
    const { talkingHeadUrl, broll1Url, broll2Url, audioOverlayUrl } = await request.json()
    if (!talkingHeadUrl) {
      return NextResponse.json({ error: 'Missing talkingHeadUrl' }, { status: 400 })
    }

    const { renderId } = await submitStitchJob({ talkingHeadUrl, broll1Url, broll2Url, audioOverlayUrl })
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
