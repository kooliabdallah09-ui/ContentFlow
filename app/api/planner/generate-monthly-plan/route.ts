import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateMonthlyPlan, BrandContext } from '@/lib/planner'
import { FormatPreferences } from '@/lib/planConfig'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.slice(7))
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { industry, platforms, frequency, formatPreferences, brandContext } = body as {
      industry: string
      platforms: string[]
      frequency: 'light' | 'moderate' | 'heavy'
      formatPreferences?: FormatPreferences
      brandContext?: BrandContext
    }

    if (!industry || !platforms || !frequency) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const plan = await generateMonthlyPlan(industry, platforms, frequency, undefined, formatPreferences, brandContext)

    return NextResponse.json({ success: true, plan })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('Generate plan error:', errorMsg)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
