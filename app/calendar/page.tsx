'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { Icon } from '@/components/Icons'
import { DailySuggestion } from '@/lib/planner'
import { showError } from '@/lib/notifications'

export default function CalendarPage() {
  const router = useRouter()
  const [plan, setPlan] = useState<DailySuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<DailySuggestion | null>(null)
  const [month, setMonth] = useState(new Date())

  useEffect(() => {
    fetchMonthlyPlan()
  }, [month])

  const fetchMonthlyPlan = async () => {
    try {
      setLoading(true)
      const monthNum = month.getMonth() + 1
      const yearNum = month.getFullYear()

      const supabase = getSupabase()
      if (!supabase) { setLoading(false); return }

      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user?.id) { setLoading(false); return }

      // DB is authoritative — always query first so plan is visible on any device
      const { data: planData, error: queryError } = await supabase
        .from('user_monthly_plans')
        .select('plan_data')
        .eq('user_id', userData.user.id)
        .eq('month', monthNum)
        .eq('year', yearNum)
        .single()

      if (planData?.plan_data) {
        setPlan(planData.plan_data)
        // Sync sessionStorage with latest DB data
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('generatedPlan', JSON.stringify(planData.plan_data))
        }
        return
      }

      // DB had nothing (or FK not fixed yet) — fall back to sessionStorage
      if (typeof window !== 'undefined') {
        const stored = sessionStorage.getItem('generatedPlan')
        if (stored) {
          try {
            setPlan(JSON.parse(stored))
            return
          } catch {}
        }
      }

      setPlan([])
    } catch (error) {
      console.error('Failed to fetch plan:', error)
    } finally {
      setLoading(false)
    }
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const monthName = month.toLocaleString('default', { month: 'long', year: 'numeric' })

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay()
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i)

  const handlePrevMonth = () => {
    setMonth(new Date(month.getFullYear(), month.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setMonth(new Date(month.getFullYear(), month.getMonth() + 1))
  }

  const getSuggestionForDay = (dayNum: number) => {
    const dateStr = new Date(month.getFullYear(), month.getMonth(), dayNum).toISOString().split('T')[0]
    return plan.find(s => s.date === dateStr)
  }

  const getStatusIcon = (completed: boolean) => completed ? '✓' : '○'

  const getContentTypeLabel = (contentType?: string) => {
    const types: { [key: string]: string } = {
      'blog': 'Blog Post',
      'video': 'Video Script',
      'social': 'Social Post',
      'email': 'Email Copy',
      'infographic': 'Infographic',
      'podcast': 'Podcast Script',
      'image': 'Image Post',
      'case-study': 'Case Study',
      'product-demo': 'Product Demo',
      'tutorial': 'Tutorial',
      'carousel': 'Carousel Post',
      'reel': 'Reel/Short Video',
    }
    return types[contentType?.toLowerCase() || ''] || contentType || 'Content'
  }

  if (loading) {
    return (
      <div className="content">
        <div style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.6 }}>
          Loading your calendar...
        </div>
      </div>
    )
  }

  return (
    <div className="content">
      <div className="page-head">
        <div className="page-meta">
          <span className="dot" />
          <Link href="/dashboard" className="eyebrow" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            ← Back to Dashboard
          </Link>
        </div>
        <h1 className="page-title">Your Monthly <em>Plan</em></h1>
        <p className="page-sub">Follow your AI-suggested content calendar. Click any day to create content.</p>
      </div>

      {/* Month Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '12px' }}>
        <button
          onClick={handlePrevMonth}
          className="btn btn-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Icon.ChevronL style={{ width: 16, height: 16 }} />
          Previous
        </button>
        <h2 className="section-title" style={{ margin: 0, fontSize: '20px' }}>{monthName}</h2>
        <button
          onClick={handleNextMonth}
          className="btn btn-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          Next
          <Icon.ChevronR style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="cal-wrap" style={{ marginBottom: '24px' }}>
        {/* Day Headers */}
        <div className="cal-grid-head">
          {dayNames.map(day => (
            <div key={day} style={{ textAlign: 'center', padding: '12px', fontSize: '12px', fontWeight: 600, color: 'var(--ink-mute)' }}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="cal-grid">
          {/* Empty cells */}
          {emptyDays.map((_, i) => (
            <div key={`empty-${i}`} className="day-card" style={{ opacity: 0, pointerEvents: 'none' }} />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(dayNum => {
            const suggestion = getSuggestionForDay(dayNum)
            return (
              <button
                key={dayNum}
                onClick={() => suggestion && setSelectedDay(suggestion)}
                className="day-card"
                style={{
                  cursor: suggestion ? 'pointer' : 'default',
                  opacity: suggestion ? 1 : 0.5,
                }}
              >
                <div className="day-head">
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-mute)' }}>{dayNum}</div>
                </div>
                {suggestion && (
                  <div className="day-items">
                    <div style={{ fontSize: '11px', color: 'var(--ink-dim)', fontWeight: 500, textAlign: 'center', flex: 1 }}>
                      {getContentTypeLabel(suggestion.contentType)}
                    </div>
                    <div style={{ fontSize: '14px', marginTop: '4px' }}>{getStatusIcon(suggestion.completed)}</div>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected Day Details */}
      {selectedDay && (
        <div className="sugg" style={{ marginBottom: '24px' }}>
          <div className="sugg-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '32px' }}>{selectedDay.icon}</span>
              <div>
                <div className="sugg-type">{selectedDay.contentType}</div>
                <h3 className="sugg-hook">{selectedDay.title}</h3>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>{getStatusIcon(selectedDay.completed)}</div>
              <span className="eyebrow">{selectedDay.completed ? 'Completed' : 'Not started'}</span>
            </div>
          </div>

          <div className="sugg-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
              <div>
                <span className="eyebrow">Date</span>
                <p style={{ fontSize: '14px', color: 'var(--ink)', marginTop: '4px' }}>
                  {selectedDay.day}, {new Date(selectedDay.date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <span className="eyebrow">Suggested time</span>
                <p style={{ fontSize: '14px', color: 'var(--ink)', marginTop: '4px' }}>{selectedDay.suggestedTime}</p>
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <span className="eyebrow">Description</span>
              <p style={{ fontSize: '14px', color: 'var(--ink-dim)', marginTop: '6px', lineHeight: 1.6 }}>
                {selectedDay.description}
              </p>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <span className="eyebrow">Platforms</span>
              <div className="sugg-tags">
                {selectedDay.platforms.map(platform => (
                  <span key={platform} style={{ padding: '6px 12px' }}>{platform}</span>
                ))}
              </div>
            </div>

            <div>
              <span className="eyebrow">Why this content</span>
              <p style={{ fontSize: '13px', color: 'var(--ink-fade)', marginTop: '6px', lineHeight: 1.5 }}>
                {selectedDay.reason}
              </p>
            </div>
          </div>

          <div className="sugg-foot">
            <button
              onClick={() => router.push(`/generate/from-calendar?date=${selectedDay.date}&contentType=${selectedDay.contentType}`)}
              className="btn btn-primary"
            >
              <Icon.Sparkle style={{ width: 14, height: 14 }} />
              Create {selectedDay.contentType}
            </button>
          </div>
        </div>
      )}

      {/* Week Overview */}
      {plan.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <div className="section-head">
            <h2 className="section-title">This Week</h2>
          </div>
          <div className="week-strip">
            {plan.slice(0, 7).map(day => {
              const date = new Date(day.date)
              const isToday = date.toDateString() === new Date().toDateString()
              return (
                <button
                  key={day.date}
                  onClick={() => setSelectedDay(day)}
                  className="day-card"
                  style={{
                    background: isToday ? 'var(--accent-soft)' : 'var(--surface)',
                    borderColor: isToday ? 'var(--accent)' : 'var(--border)',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--ink-mute)', fontWeight: 600, marginBottom: '6px' }}>
                    {day.day}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ink-dim)', fontWeight: 500, marginBottom: '6px', textAlign: 'center' }}>
                    {getContentTypeLabel(day.contentType)}
                  </div>
                  <div style={{ fontSize: '14px' }}>{getStatusIcon(day.completed)}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {plan.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', opacity: 0.6 }}>
          <p style={{ marginBottom: '18px' }}>No monthly plan yet. Complete onboarding to generate your personalized content calendar.</p>
          <Link href="/onboarding/plan" className="btn btn-primary">
            <Icon.Sparkle style={{ width: 14, height: 14 }} />
            Create Monthly Plan
          </Link>
        </div>
      )}
    </div>
  )
}
