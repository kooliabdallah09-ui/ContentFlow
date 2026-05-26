import { NextRequest, NextResponse } from 'next/server'
import { generateMonthlyPlan } from '@/lib/planner'
import { FormatPreferences } from '@/lib/planConfig'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { industry, platforms, frequency, formatPreferences } = body as {
      industry: string
      platforms: string[]
      frequency: 'light' | 'moderate' | 'heavy'
      formatPreferences?: FormatPreferences
    }

    if (!industry || !platforms || !frequency) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const plan = await generateMonthlyPlan(industry, platforms, frequency, undefined, formatPreferences)

    return NextResponse.json({ success: true, plan })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('Generate plan error:', errorMsg)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
