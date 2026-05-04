import { NextRequest, NextResponse } from 'next/server'
import { executeScheduledPublishes } from '@/lib/jobs/scheduler'

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret token
    const authHeader = request.headers.get('authorization')
    const expectedToken = `Bearer ${process.env.CRON_SECRET}`

    if (authHeader !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await executeScheduledPublishes()

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Execute error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Execution failed',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret token
    const authHeader = request.headers.get('authorization')
    const expectedToken = `Bearer ${process.env.CRON_SECRET}`

    if (authHeader !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await executeScheduledPublishes()

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Execute error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Execution failed',
      },
      { status: 500 }
    )
  }
}
