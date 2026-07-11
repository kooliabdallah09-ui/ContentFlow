'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import type { DailySuggestion } from '@/lib/planner'
import { savePrefill } from '@/lib/calendar-prefill'
import { Loader2, RefreshCcw, ArrowRight, ExternalLink, Trash2 } from 'lucide-react'

function YTIcon({ size = 14, color }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color ?? 'currentColor'}>
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )
}
import ScheduleYouTubeModal, { type ScheduledJob } from '@/components/ScheduleYouTubeModal'

const CONTENT_ICONS: Record<string, string> = {
  ugc:         '◉',
  video:       '▶',
  image:       '◐',
  voice:       '♪',
  social:      '☉',
  'screen-demo': '⬡',
  rest:        '○',
}

const CONTENT_HREF: Record<string, string> = {
  ugc:         '/generate/ugc',
  video:       '/generate/video',
  image:       '/generate/image',
  voice:       '/generate/voice',
  social:      '/generate/social',
  'screen-demo': '/generate/screen-demo',
}

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  queued:    { label: '⏳ Queued',     bg: 'rgba(100,100,100,0.1)',    color: 'var(--ink-2)' },
  uploading: { label: '⬆ Uploading',  bg: 'rgba(59,130,246,0.12)',    color: '#3b82f6' },
  published: { label: '✓ Published',  bg: 'rgba(47,122,78,0.12)',     color: 'var(--good)' },
  failed:    { label: '✗ Failed',     bg: 'rgba(184,58,53,0.1)',      color: 'var(--danger)' },
}

export default function CalendarPage() {
  const router = useRouter()
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [plan, setPlan]               = useState<DailySuggestion[] | null>(null)
  const [selectedDay, setSelectedDay] = useState<DailySuggestion | null>(null)
  const [error, setError]             = useState<string | null>(null)

  // YouTube queue state
  const [ytJobs, setYtJobs]           = useState<ScheduledJob[]>([])
  const [showYtModal, setShowYtModal] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const now = useMemo(() => new Date(), [])
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  useEffect(() => { loadPlan() }, [])
  useEffect(() => { loadYtQueue() }, [])

  async function getToken() {
    const supabase = getSupabase()
    if (!supabase) return null
    const { data: sess } = await supabase.auth.getSession()
    return sess?.session?.access_token ?? null
  }

  async function loadPlan() {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not signed in')

      const res = await fetch(
        `/api/planner/get-monthly-plan?month=${now.getMonth() + 1}&year=${now.getFullYear()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load plan')

      const days: DailySuggestion[] = Array.isArray(data.plan) ? data.plan : []
      // Explicitly do NOT fall back to sessionStorage — it leaks a previous
      // user's plan into the current account when someone signs out/in in the
      // same tab. Empty is empty.
      try { sessionStorage.removeItem('generatedPlan') } catch {}
      if (days.length === 0) {
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

  async function loadYtQueue() {
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch('/api/youtube/queue', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const data = await res.json()
      setYtJobs(data.jobs ?? [])
    } catch {}
  }

  function findTodayOrFirst(days: DailySuggestion[]): DailySuggestion | null {
    const todayStr = new Date().toISOString().slice(0, 10)
    return days.find(d => d.date === todayStr) ?? days[0] ?? null
  }

  function jobForDay(date: string): ScheduledJob | undefined {
    return ytJobs.find(j => j.calendar_date === date)
  }

  async function cancelJob(id: string) {
    setCancellingId(id)
    try {
      const token = await getToken()
      if (!token) return
      await fetch(`/api/youtube/queue?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setYtJobs(prev => prev.filter(j => j.id !== id))
    } finally {
      setCancellingId(null)
    }
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

      const { data: brand } = await supabase
        .from('brand_profiles')
        .select('company_name, description, target_audience, tone_of_voice, unique_value_prop, brand_mission, customer_pain_points, product_type, posting_frequency')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!brand) throw new Error('No brand profile yet — fill it in first.')

      const platforms = ['instagram']
      const frequency = (brand.posting_frequency as 'light' | 'moderate' | 'heavy') || 'moderate'

      const accessToken = sess?.session?.access_token
      if (!accessToken) throw new Error('Not signed in')

      const genRes = await fetch('/api/planner/generate-monthly-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ month: m, year: y, plan_data: newPlan }),
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
        {error && <p style={{ marginTop: 18, fontSize: 12, color: 'var(--danger)' }}>{error}</p>}
      </main>
    )
  }

  const firstDate = plan[0]?.date ? new Date(plan[0].date) : new Date()
  const startWeekday = (firstDate.getDay() + 6) % 7
  const cells: (DailySuggestion | null)[] = Array(startWeekday).fill(null).concat(plan as (DailySuggestion | null)[])
  while (cells.length % 7 !== 0) cells.push(null)

  const selectedJob = selectedDay ? jobForDay(selectedDay.date) : undefined

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
              if (!cell) return <div key={`empty-${i}`} style={{ aspectRatio: '1', borderRadius: 11, background: 'transparent' }} />
              const active = selectedDay?.date === cell.date
              const dateObj = new Date(cell.date)
              const dayNum = dateObj.getDate()
              const isToday = cell.date === new Date().toISOString().slice(0, 10)
              const icon = CONTENT_ICONS[cell.contentType] ?? '◯'
              const job = jobForDay(cell.date)

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
                    color: active ? 'var(--on-ink)' : 'var(--ink)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    cursor: 'pointer', transition: 'all 0.15s',
                    minWidth: 0, overflow: 'hidden',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500,
                      color: active ? 'var(--on-ink)' : (isToday ? 'var(--ink)' : 'var(--ink-mute)'),
                    }}>{dayNum}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      {cell.completed && (
                        <span style={{ fontSize: 11, color: active ? 'var(--on-ink-dim)' : 'var(--good)' }}>✓</span>
                      )}
                      {job && (
                        <span title={`YouTube: ${job.status}`} style={{ fontSize: 9, lineHeight: 1 }}>
                          {job.status === 'published' ? '🔴' : job.status === 'failed' ? '⚠️' : '📅'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, lineHeight: 1, marginBottom: 4, color: active ? 'var(--on-ink)' : 'var(--ink-2)' }}>{icon}</div>
                    <div style={{
                      fontSize: 10.5, lineHeight: 1.2, fontWeight: 500,
                      color: active ? 'var(--on-ink-dim)' : 'var(--ink-dim)',
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

              {(selectedDay.contentType as string) !== 'rest' && (
                <button
                  onClick={() => {
                    savePrefill(selectedDay)
                    router.push(CONTENT_HREF[selectedDay.contentType] ?? '/dashboard')
                  }}
                  className="btn btn-primary"
                  style={{ display: 'flex', width: '100%', padding: 12, fontSize: 13.5, borderRadius: 11, marginBottom: 10, alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', border: 'none' }}
                >
                  Create now
                  <ArrowRight size={14} />
                </button>
              )}

              {/* YouTube scheduling section */}
              {selectedJob ? (
                <div style={{
                  borderRadius: 11, border: '1px solid var(--border)',
                  background: 'var(--surface-2)', overflow: 'hidden',
                }}>
                  {/* Status bar */}
                  <div style={{
                    padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
                    borderBottom: selectedJob.status !== 'published' ? '1px solid var(--border-soft)' : undefined,
                  }}>
                    <YTIcon size={14} color="#FF0000" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedJob.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 1 }}>
                        {new Date(selectedJob.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                    {(() => {
                      const b = STATUS_BADGE[selectedJob.status]
                      return (
                        <span style={{
                          fontSize: 10.5, fontWeight: 600, padding: '2px 8px',
                          borderRadius: 99, background: b.bg, color: b.color,
                          whiteSpace: 'nowrap',
                        }}>{b.label}</span>
                      )
                    })()}
                  </div>

                  {/* Published link */}
                  {selectedJob.status === 'published' && selectedJob.yt_video_url && (
                    <a href={selectedJob.yt_video_url} target="_blank" rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', fontSize: 12, color: '#FF0000',
                        textDecoration: 'none', fontWeight: 600,
                      }}>
                      <ExternalLink size={12} />
                      Watch on YouTube
                    </a>
                  )}

                  {/* Cancel button for queued jobs */}
                  {selectedJob.status === 'queued' && (
                    <button
                      onClick={() => cancelJob(selectedJob.id)}
                      disabled={cancellingId === selectedJob.id}
                      style={{
                        width: '100%', padding: '8px 14px',
                        background: 'none', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 12, color: 'var(--ink-mute)',
                      }}>
                      {cancellingId === selectedJob.id
                        ? <><Loader2 size={11} className="animate-spin" /> Cancelling…</>
                        : <><Trash2 size={11} /> Cancel schedule</>}
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowYtModal(true)}
                  style={{
                    width: '100%', padding: '11px 0', borderRadius: 11,
                    background: 'transparent',
                    border: '1.5px dashed var(--border-strong)',
                    color: 'var(--ink-2)', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 7,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#FF0000'
                    e.currentTarget.style.color = '#FF0000'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border-strong)'
                    e.currentTarget.style.color = 'var(--ink-2)'
                  }}
                >
                  <YTIcon size={14} />
                  Schedule to YouTube
                </button>
              )}
            </div>
          ) : (
            <div className="card" style={{ padding: 22, color: 'var(--ink-mute)', fontSize: 13 }}>
              Pick a day to see the suggestion.
            </div>
          )}
        </aside>
      </div>

      {/* YouTube schedule modal */}
      {showYtModal && selectedDay && (
        <ScheduleYouTubeModal
          prefill={{
            title: selectedDay.title,
            description: selectedDay.description,
            calendarDate: selectedDay.date,
            suggestedTime: selectedDay.suggestedTime || '9:00 AM',
          }}
          onClose={() => setShowYtModal(false)}
          onScheduled={job => {
            setYtJobs(prev => [...prev.filter(j => j.calendar_date !== job.calendar_date), job])
            setShowYtModal(false)
          }}
        />
      )}

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
