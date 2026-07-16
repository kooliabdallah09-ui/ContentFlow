import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { formatToContentType } from '@/lib/format-to-route'

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
    // platform). Convert it to DailySuggestion, anchoring day 1 to the plan's
    // creation date so a plan generated on July 12 covers July 12 -> Aug 11,
    // and filling non-post days with 'Rest Day' entries so the grid looks
    // intentional.
    const { data: intel } = await supabase
      .from('content_plans')
      .select('calendar_30d, created_at, updated_at')
      .eq('user_id', user.id)
      .maybeSingle()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cal: any[] = Array.isArray(intel?.calendar_30d) ? intel!.calendar_30d : []
    if (!cal.length) {
      return NextResponse.json({ success: true, plan: [] })
    }

    const anchorRaw = intel?.created_at ?? intel?.updated_at ?? new Date().toISOString()
    const anchor = new Date(anchorRaw)
    // Normalise to UTC midnight so day math stays consistent.
    const anchorUtc = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()))

    // Pull product_type so 'tutorial' resolves to screen-demo only for
    // software products and stays as UGC for physical products.
    const { data: brand } = await supabase
      .from('brand_profiles')
      .select('product_type')
      .eq('user_id', user.id)
      .maybeSingle()
    const productType = brand?.product_type ?? null

    const isoFor = (d: Date) => d.toISOString().slice(0, 10)
    const addDays = (d: Date, n: number) => {
      const copy = new Date(d)
      copy.setUTCDate(copy.getUTCDate() + n)
      return copy
    }

    // Index posts by their absolute date within the 30-day window.
    const postByDate = new Map<string, unknown>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const entry of cal as any[]) {
      const offset = (Number(entry.day) || 1) - 1
      const date = addDays(anchorUtc, offset)
      postByDate.set(isoFor(date), entry)
    }

    // Build a 30-day array: post for that day, else a Rest Day filler.
    const converted: unknown[] = []
    for (let i = 0; i < 30; i++) {
      const date = addDays(anchorUtc, i)
      const iso = isoFor(date)
      const dayLabel = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entry: any = postByDate.get(iso)
      if (entry) {
        const format = String(entry.format ?? 'ugc')
        // main_idea is the director's brief; hook is the spoken first line.
        // Description surfaces the main_idea when present so the downstream
        // enhance-prompt call (which reads description as the video-
        // direction seed) sees the concrete concept, not just the hook.
        const hook = String(entry.hook ?? '').trim()
        const mainIdea = String(entry.main_idea ?? '').trim()
        converted.push({
          date: iso,
          day: dayLabel,
          contentType: formatToContentType(format, productType),
          title: hook.slice(0, 120) || mainIdea.slice(0, 120),
          description: mainIdea || hook,
          icon: '◉',
          platforms: entry.platform ? [String(entry.platform)] : ['tiktok'],
          suggestedTime: String(entry.best_time ?? '18:00'),
          reason: `${entry.week_theme ?? 'Week ' + entry.week}: ${format} format`,
          completed: false,
        })
      } else {
        converted.push({
          date: iso,
          day: dayLabel,
          contentType: 'rest',
          title: 'Rest Day',
          description: 'No content scheduled — recover and engage with your audience.',
          icon: '○',
          platforms: [],
          suggestedTime: '',
          reason: 'Sustainable cadence',
          completed: false,
        })
      }
    }

    return NextResponse.json({ success: true, plan: converted, source: 'intelligence' })
  } catch (error) {
    console.error('Get monthly plan error:', error)
    return NextResponse.json(
      { error: 'Internal server error', plan: [] },
      { status: 500 }
    )
  }
}
