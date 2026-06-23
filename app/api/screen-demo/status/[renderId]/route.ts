import { NextRequest, NextResponse } from 'next/server'
import { getStitchStatus } from '@/lib/shotstack'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ renderId: string }> },
) {
  try {
    const { renderId } = await params
    if (!renderId) return NextResponse.json({ error: 'Missing renderId' }, { status: 400 })
    const result = await getStitchStatus(renderId)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Status check failed' },
      { status: 500 },
    )
  }
}
