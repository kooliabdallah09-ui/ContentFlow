'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'
import type { DailySuggestion } from '@/lib/planner'
import { Loader2, RefreshCcw, ArrowRight } from 'lucide-react'

// Calendar — reads the user's saved monthly plan and renders it as an
// editorial day grid + day-detail rail on the right. The plan itself is
// generated during onboarding (/onboarding/brand) which calls
// /api/planner/generate-monthly-plan then /api/planner/save-plan. This
// page just displays and allows opening generations from the suggestions.
//
// If no plan exists yet, we show a clear "Set up your plan" CTA pointing
// at the onboarding flow.

const CONTENT_ICONS: Record<string, string> = {
  ugc: '◉',
  video: '▶',
  image: '◐',
  voice: '♪',
  blog: '¶',
  social: '☉',
}

const CONTENT_HREF: Record<string, string> = {
  ugc: '/generate/ugc',
  video: '/generate/video',
  image: '/generate/image',
  voice: '/generate/voice',
  blog: '/generate/blog',
  social: '/generate/social',
}

export default function CalendarPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [plan, setPlan] = useState<DailySuggestion[] | null>(null)
  const [selectedDay, setSelectedDay] = useState<DailySuggestion | null>(null)
  const [error, setError] = useState<string | null>(null)

  const now = useMemo(() => new Date(), [])
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  useEffect(() => {
    loadPlan()
  }, [])

  async function loadPlan() {
    setLoading(true)
    setError(null)
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Auth not ready')
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch(
        `/api/planner/get-monthly-plan?month=${now.getMonth() + 1}&year=${now.getFullYear()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load plan')

      const days: DailySuggestion[] = Array.isArray(data.plan) ? data.plan : []
      if (days.length === 0) {
        // Fallback to the session-cached plan from onboarding
        try {
          const cached = sessionStorage.getItem('generatedPlan')
          if (cached) {
            const parsed = JSON.parse(cached) as DailySuggestion[]
            if (Array.isArray(parsed) && parsed.length > 0) {
              setPlan(parsed)
              setSelectedDay(findTodayOrFirst(parsed))
              return
            }
          }
        } catch {}
        setPlan([])
        setSelectedDay(null)
      } else {
        setPlan(days)
        setSelectedDay(findTodayOrFirst(days))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plan')
      setPlan([])
    } finally {
      setLoading(false)
    }
  }

  function findTodayOrFirst(days: DailySuggestion[]): DailySuggestion | null {
    const todayStr = new Date().toISOString().slice(0, 10)
    return days.find(d => d.date === todayStr) ?? days[0] ?? null
  }

  async function regenerate() {
    if (!confirm('Regenerate this month\'s plan? Your current schedule will be replaced.')) return
    setRefreshing(true)
    setError(null)
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Auth not ready')
      const { data: sess } = await supabase.auth.getSession()
      const user = sess?.session?.user
      if (!user) throw new Error('Not signed in')

      // Pull the user's brand profile to feed the planner.
      const { data: brand } = await supabase
        .from('brand_profiles')
        .select('company_name, description, target_audience, tone_of_voice, unique_value_prop, brand_mission, customer_pain_points, product_type, posting_frequency')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!brand) {
        throw new Error('No brand profile yet — fill it in first.')
      }

      const platforms = ['tiktok', 'instagram']
      const frequency = (brand.posting_frequency as 'light' | 'moderate' | 'heavy') || 'moderate'

      const genRes = await fetch('/api/planner/generate-monthly-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: brand.product_type || 'general',
          platforms,
          frequency,
          brandContext: {
            name: brand.company_name,
            description: brand.description,
            productType: brand.product_type,
            targetAudience: brand.target_audience,
            toneOfVoice: brand.tone_of_voice,
            uniqueValue: brand.unique_value_prop,
            brandMission: brand.brand_mission,
            customerPainPoints: brand.customer_pain_points,
          },
        }),
      })
      const genData = await genRes.json()
      if (!genRes.ok) throw new Error(genData.error || 'Generation failed')

      const newPlan: DailySuggestion[] = genData.plan
      const m = now.getMonth() + 1
      const y = now.getFullYear()
      const saveRes = await fetch('/api/planner/save-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, month: m, year: y, plan_data: newPlan }),
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok) throw new Error(saveData.error || 'Failed to save plan')

      try { sessionStorage.setItem('generatedPlan', JSON.stringify(newPlan)) } catch {}
      setPlan(newPlan)
      setSelectedDay(findTodayOrFirst(newPlan))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regenerate failed')
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <main className="content">
        <div className="page-meta">{monthLabel}</div>
        <h1 className="page-title">Monthly <em>plan</em></h1>
        <p style={{ marginTop: 24, color: 'var(--ink-mute)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Loader2 size={14} className="animate-spin" /> Loading your plan…
        </p>
      </main>
    )
  }

  if (!plan || plan.length === 0) {
    return (
      <main className="content">
        <div className="page-meta">{monthLabel}</div>
        <h1 className="page-title">No plan <em>yet</em>.</h1>
        <p className="page-sub">
          Set up your brand profile and we&apos;ll draft a tailored content calendar for the next 30 days —
          a mix of UGC, social posts, and product moments matched to your audience.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 28, flexWrap: 'wrap' }}>
          <Link href="/onboarding/brand" className="btn btn-primary"
            style={{ padding: '12px 22px', fontSize: 14, borderRadius: 11 }}>
            Generate my plan
            <ArrowRight size={15} />
          </Link>
          <Link href="/settings/brand" className="btn"
            style={{ padding: '12px 22px', fontSize: 14, borderRadius: 11 }}>
            Edit brand profile
          </Link>
        </div>
        {error && (
          <p style={{ marginTop: 18, fontSize: 12, color: 'var(--danger)' }}>{error}</p>
        )}
      </main>
    )
  }

  // Calendar grid: render the days laid out in their actual weekday columns.
  // Group plan entries into weeks of 7 (pad with nulls to align Monday-first).
  const firstDate = plan[0]?.date ? new Date(plan[0].date) : new Date()
  const startWeekday = (firstDate.getDay() + 6) % 7 // 0 = Monday
  const cells: (DailySuggestion | null)[] = Array(startWeekday).fill(null).concat(plan as (DailySuggestion | null)[])
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <main className="content" style={{ maxWidth: 1180 }}>
      <div className="page-meta">{monthLabel.toUpperCase()}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Monthly <em>plan</em></h1>
        <button onClick={regenerate} disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 16px', borderRadius: 10,
            background: 'var(--surface)', border: '1px solid var(--border)',
            color: 'var(--ink-2)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={13} />}
          {refreshing ? 'Generating…' : 'Regenerate'}
        </button>
      </div>

      {error && (
        <div style={{
          marginTop: 14, padding: '10px 14px',
          background: 'rgba(184,58,53,0.08)', border: '1px solid var(--danger)',
          color: 'var(--danger)', borderRadius: 11, fontSize: 13,
        }}>{error}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 20, marginTop: 28 }} className="cal-grid-wrap">
        {/* Calendar grid */}
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 10 }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-fade)', textAlign: 'center', fontWeight: 600 }}>
                {d}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {cells.map((cell, i) => {
              if (!cell) {
                return <div key={`empty-${i}`} style={{ aspectRatio: '1', borderRadius: 11, background: 'transparent' }} />
              }
              const active = selectedDay?.date === cell.date
              const dateObj = new Date(cell.date)
              const dayNum = dateObj.getDate()
              const isToday = cell.date === new Date().toISOString().slice(0, 10)
              const icon = CONTENT_ICONS[cell.contentType] ?? '◯'
              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => setSelectedDay(cell)}
                  style={{
                    aspectRatio: '1', textAlign: 'left',
                    padding: 10, borderRadius: 11,
                    background: active ? 'var(--ink)' : 'var(--surface)',
                    border: `1px solid ${active ? 'var(--ink)' : (isToday ? 'var(--border-strong)' : 'var(--border)')}`,
                    color: active ? '#fff' : 'var(--ink)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    cursor: 'pointer', transition: 'all 0.15s',
                    minWidth: 0, overflow: 'hidden',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500,
                      color: active ? '#fff' : (isToday ? 'var(--ink)' : 'var(--ink-mute)'),
                    }}>{dayNum}</span>
                    {cell.completed && (
                      <span style={{ fontSize: 11, color: active ? 'rgba(255,255,255,0.7)' : 'var(--good)' }}>✓</span>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 16, lineHeight: 1, marginBottom: 4,
                      color: active ? '#fff' : 'var(--ink-2)',
                    }}>{icon}</div>
                    <div style={{
                      fontSize: 10.5, lineHeight: 1.2, fontWeight: 500,
                      color: active ? 'rgba(255,255,255,0.85)' : 'var(--ink-dim)',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                    }}>
                      {cell.title}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Day detail */}
        <aside style={{ position: 'sticky', top: 20, alignSelf: 'start' }} className="cal-aside">
          {selectedDay ? (
            <div className="card" style={{ padding: 22 }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: 'var(--ink-fade)', marginBottom: 6,
              }}>
                {new Date(selectedDay.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
              <h2 style={{
                fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 24,
                lineHeight: 1.15, letterSpacing: '-0.01em', margin: '4px 0 12px',
              }}>
                {selectedDay.title}
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', lineHeight: 1.55, margin: '0 0 16px' }}>
                {selectedDay.description}
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                <span style={pill}>{selectedDay.contentType.toUpperCase()}</span>
                {selectedDay.platforms?.map(p => <span key={p} style={pill}>{p}</span>)}
                {selectedDay.suggestedTime && <span style={pill}>{selectedDay.suggestedTime}</span>}
              </div>

              {selectedDay.reason && (
                <p style={{ fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.5, margin: '0 0 18px', fontStyle: 'italic' }}>
                  {selectedDay.reason}
                </p>
              )}

              <Link href={CONTENT_HREF[selectedDay.contentType] ?? '/dashboard'}
                className="btn btn-primary"
                style={{ display: 'flex', width: '100%', padding: 12, fontSize: 13.5, borderRadius: 11 }}>
                Create now
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="card" style={{ padding: 22, color: 'var(--ink-mute)', fontSize: 13 }}>
              Pick a day to see the suggestion.
            </div>
          )}
        </aside>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .cal-grid-wrap { grid-template-columns: 1fr !important; }
          .cal-aside { position: static !important; }
        }
      `}</style>
    </main>
  )
}

const pill: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em',
  textTransform: 'uppercase', padding: '3px 8px',
  borderRadius: 5, background: 'var(--hover)', color: 'var(--ink-2)',
  fontFamily: 'var(--font-mono)',
}
