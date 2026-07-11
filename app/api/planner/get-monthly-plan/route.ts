import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)

    // Verify the token and get user info
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    if (!month || !year) {
      return NextResponse.json(
        { error: 'Missing month or year parameter' },
        { status: 400 }
      )
    }

    // Fetch the plan from the legacy brand-based table first.
    const { data, error } = await supabase
      .from('user_monthly_plans')
      .select('plan_data')
      .eq('user_id', user.id)
      .eq('month', parseInt(month))
      .eq('year', parseInt(year))
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Database error:', error)
    }

    if (Array.isArray(data?.plan_data) && data.plan_data.length > 0) {
      return NextResponse.json({ success: true, plan: data.plan_data })
    }

    // Fallback: the new intelligence flow writes to content_plans.calendar_30d
    // with a different shape (day, week, format, hook, hashtags, best_time,
    // platform). Convert it to DailySuggestion so the calendar renders.
    const { data: intel } = await supabase
      .from('content_plans')
      .select('calendar_30d, updated_at')
      .eq('user_id', user.id)
      .maybeSingle()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cal: any[] = Array.isArray(intel?.calendar_30d) ? intel!.calendar_30d : []
    if (!cal.length) {
      return NextResponse.json({ success: true, plan: [] })
    }

    // Anchor calendar to the requested month/year — day 1 = first of the month.
    const yearN = parseInt(year)
    const monthN = parseInt(month) - 1 // 0-indexed
    const CONTENT_TYPE_MAP: Record<string, string> = {
      grwm: 'ugc', before_after: 'video', hot_take: 'ugc', unboxing: 'video',
      review: 'ugc', tutorial: 'screen-demo', pov: 'ugc', storytime: 'ugc',
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const converted = cal.map((entry: any) => {
      const dayNum = Number(entry.day) || 1
      const date = new Date(Date.UTC(yearN, monthN, dayNum))
      const iso = date.toISOString().slice(0, 10)
      const format = String(entry.format ?? 'ugc')
      return {
        date: iso,
        day: date.toLocaleDateString('en-US', { weekday: 'long' }),
        contentType: CONTENT_TYPE_MAP[format] ?? 'ugc',
        title: String(entry.hook ?? '').slice(0, 120),
        description: String(entry.hook ?? ''),
        icon: '◉',
        platforms: entry.platform ? [String(entry.platform)] : ['tiktok'],
        suggestedTime: String(entry.best_time ?? '18:00'),
        reason: `${entry.week_theme ?? 'Week ' + entry.week}: ${format} format`,
        completed: false,
      }
    })

    return NextResponse.json({ success: true, plan: converted, source: 'intelligence' })
  } catch (error) {
    console.error('Get monthly plan error:', error)
    return NextResponse.json(
      { error: 'Internal server error', plan: [] },
      { status: 500 }
    )
  }
}
