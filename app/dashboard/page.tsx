'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import Link from 'next/link'
import { Icon } from '@/components/Icons'
import { DailySuggestion } from '@/lib/planner'

interface DashboardStats {
  piecesShipped: number
  totalReach: number
  engagementRate: number
  bestFormat: string
  postingStreak: number
}

export default function DashboardPage() {
  const [userName, setUserName] = useState('Creator')
  const [todaySuggestion, setTodaySuggestion] = useState<DailySuggestion | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    piecesShipped: 0,
    totalReach: 0,
    engagementRate: 0,
    bestFormat: 'Video',
    postingStreak: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const supabase = getSupabase()
      if (!supabase) return

      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        setUserName(userData.user.user_metadata?.full_name || 'Creator')
      }

      const today = new Date()
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      const { data: sessionData } = await supabase.auth.getSession()

      // Fetch monthly plan for today's suggestion
      const planResponse = await fetch(
        `/api/planner/get-monthly-plan?month=${today.getMonth() + 1}&year=${today.getFullYear()}`,
        {
          headers: {
            Authorization: `Bearer ${sessionData.session?.access_token || ''}`,
          },
        }
      )

      if (planResponse.ok) {
        const data = await planResponse.json()
        const plan = data.plan || []
        const todayDate = today.toISOString().split('T')[0]
        const todaySugg = plan.find((s: DailySuggestion) => s.date === todayDate)
        setTodaySuggestion(todaySugg || null)
      }

      // Fetch analytics data
      const { data: contentData } = await supabase
        .from('content')
        .select('id, content_type, created_at, published')
        .eq('user_id', userData.user?.id)
        .eq('published', true)
        .gte('created_at', monthStart.toISOString())

      const { data: analyticsData } = await supabase
        .from('content_analytics')
        .select('impressions, engagement_rate')
        .eq('user_id', userData.user?.id)
        .gte('fetched_at', monthStart.toISOString())

      const piecesShipped = contentData?.length || 0
      const totalReach = analyticsData?.reduce((sum: number, item: any) => sum + (item.impressions || 0), 0) || 0
      const avgEngagement = analyticsData?.length
        ? (analyticsData.reduce((sum: number, item: any) => sum + (item.engagement_rate || 0), 0) / analyticsData.length) * 100
        : 0

      // Determine best format
      const contentByType = contentData?.reduce((acc: Record<string, number>, item: any) => {
        acc[item.content_type] = (acc[item.content_type] || 0) + 1
        return acc
      }, {})
      const bestFormat = contentByType ? Object.keys(contentByType).reduce((a, b) =>
        contentByType[a] > contentByType[b] ? a : b, 'Video') : 'Video'

      // Calculate posting streak (consecutive days with published content)
      const { data: calendarData } = await supabase
        .from('content_calendar')
        .select('published_date, status')
        .eq('user_id', userData.user?.id)
        .eq('status', 'published')
        .order('published_date', { ascending: false })
        .limit(60)

      let streak = 0
      if (calendarData && calendarData.length > 0) {
        let currentDate = new Date(today)
        currentDate.setHours(0, 0, 0, 0)

        for (const entry of calendarData) {
          const entryDate = new Date(entry.published_date)
          entryDate.setHours(0, 0, 0, 0)
          const dayDiff = Math.floor((currentDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24))

          if (dayDiff === streak) {
            streak++
          } else {
            break
          }
        }
      }

      setStats({
        piecesShipped,
        totalReach,
        engagementRate: Math.round(avgEngagement * 10) / 10,
        bestFormat: bestFormat.charAt(0).toUpperCase() + bestFormat.slice(1),
        postingStreak: streak,
      })
    } catch (error) {
      console.error('Failed to load dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="content">Loading...</div>
  }

  const today = new Date()
  const monthName = today.toLocaleString('default', { month: 'long' })
  const dayName = today.toLocaleString('default', { weekday: 'long' })
  const dayNum = today.getDate()

  // Calculate actual week of year
  const firstDay = new Date(today.getFullYear(), 0, 1)
  const daysToWeek = (today.getTime() - firstDay.getTime()) / 86400000
  const weekNum = Math.ceil((daysToWeek + firstDay.getDay() + 1) / 7)

  return (
    <div className="content">
      <div className="page-head">
        <div className="page-meta">
          <span className="dot" />
          <span className="eyebrow">{dayName} · {monthName} {dayNum} · {today.getFullYear()}</span>
          <span className="eyebrow" style={{ color: 'var(--ink-fade)' }}>Week {weekNum} of 52</span>
        </div>
        <h1 className="page-title">
          Good morning, <em>{userName}.</em><br />
          {todaySuggestion ? <>Ship something <em>great</em> today.</> : <>Ready to <em>create?</em></>}
        </h1>
        <p className="page-sub">
          {todaySuggestion 
            ? 'Your AI-suggested content is ready. Approve, edit, or swap for something different.'
            : 'Check the calendar for your monthly plan, or start fresh with a new idea.'}
        </p>
      </div>

      {/* Hero row */}
      <div className="hero-grid">
        <div className="hero-card">
          <div className="hero-eyebrow">
            <span className="eyebrow">Today's brief</span>
            <span className="eyebrow" style={{ color: 'var(--ink-fade)' }}>Generated now</span>
          </div>
          {todaySuggestion ? (
            <>
              <h2 className="hero-headline">
                {todaySuggestion.title.split(' ').slice(0, 3).join(' ')} <em>{todaySuggestion.title.split(' ').slice(3).join(' ')}</em>
              </h2>
              <div className="hero-foot">
                <Link href={`/generate/from-calendar?date=${todaySuggestion.date}&contentType=${todaySuggestion.contentType}`} className="btn btn-primary">
                  <Icon.Sparkle style={{ width: 14, height: 14 }}/> Create now
                </Link>
                <Link href="/calendar" className="btn btn-ghost">Skip <Icon.Arrow style={{ width: 13, height: 13 }}/></Link>
              </div>
            </>
          ) : (
            <>
              <h2 className="hero-headline">
                No suggestions <em>yet.</em>
              </h2>
              <div className="hero-foot">
                <Link href="/calendar" className="btn btn-primary">
                  <Icon.Calendar /> View calendar
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="streak-card">
          <div className="eyebrow">Posting streak</div>
          <h3 className="streak-num">{stats.postingStreak || '–'}<em>d</em></h3>
          <div className="streak-meta">
            <div className="streak-dots">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className={`streak-dot ${i < stats.postingStreak ? 'on' : ''}`} />
              ))}
            </div>
            <span>Last 7 days</span>
          </div>
          <div className="divider" style={{ margin: '6px 0' }} />
          <div className="streak-meta" style={{ justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--ink-mute)' }}>Next milestone</span>
            <span><strong>30 days</strong> · {Math.max(0, 30 - stats.postingStreak)} away</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="section-head">
        <h2 className="section-title">Momentum <em>this month</em></h2>
        <div className="section-actions">
          <Link href="/analytics">Full analytics →</Link>
        </div>
      </div>
      <div className="stats-row">
        <div className="stat">
          <span className="stat-label">Pieces shipped</span>
          <div className="stat-num">{stats.piecesShipped || '–'}</div>
          <span className="stat-delta">This month</span>
        </div>
        <div className="stat">
          <span className="stat-label">Total reach</span>
          <div className="stat-num">
            {stats.totalReach > 0 ? (
              <>
                {Math.floor(stats.totalReach / 1000) || stats.totalReach}
                <em>{stats.totalReach > 999 ? 'k' : ''}</em>
              </>
            ) : (
              '–'
            )}
          </div>
          <span className="stat-delta">Impressions</span>
        </div>
        <div className="stat">
          <span className="stat-label">Engagement rate</span>
          <div className="stat-num">
            {stats.engagementRate > 0 ? (
              <>
                {stats.engagementRate}
                <em>%</em>
              </>
            ) : (
              '–'
            )}
          </div>
          <span className="stat-delta">Average</span>
        </div>
        <div className="stat">
          <span className="stat-label">Best format</span>
          <div className="stat-num" style={{ fontSize: 28, paddingTop: 6, fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
            {stats.bestFormat}
          </div>
          <span className="stat-delta">Top performing</span>
        </div>
      </div>

      <Link href="/calendar" className="btn btn-primary" style={{ marginTop: '48px' }}>
        <Icon.Calendar /> View full calendar
      </Link>
    </div>
  )
}
