import { NextRequest, NextResponse } from 'next/server'
import { generateMonthlyPlan } from '@/lib/planner'

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()
    const { industry, platforms, frequency } = body

    if (!industry || !platforms || !frequency) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Generate the plan using Claude
    const plan = await generateMonthlyPlan(industry, platforms, frequency)

    return NextResponse.json({
      success: true,
      plan,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('Generate plan error:', errorMsg)
    console.error('Full error:', error)
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    )
  }
}
