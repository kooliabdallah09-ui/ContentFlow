'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'
import { RefreshCcw, ArrowUpRight, Loader2 } from 'lucide-react'
import { showError, showSuccess } from '@/lib/notifications'

interface CalendarEntry {
  day: number
  week: number
  week_theme: string
  format: string
  hook: string
  hashtags: string[]
  best_time: string
  platform: string
}

interface FormatScore {
  format: string
  score: number
  why: string
}

interface Plan {
  plan_data?: { niche_opportunity?: string; competition_level?: string; audience_pain_points?: string[] }
  top_formats?: FormatScore[]
  hooks?: Record<string, string[]>
  calendar_30d?: CalendarEntry[]
  trending_hashtags?: string[]
  refresh_date?: string
}

// Dashboard "Content Intelligence" panel — top formats + calendar preview +
// "Generate ↗" buttons that prefill the UGC generator via URL params.
export default function ContentPlanSection() {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [hasProfile, setHasProfile] = useState(false)
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    const supabase = getSupabase()
    if (!supabase) { setLoading(false); return }
    const { data: sess } = await supabase.auth.getSession()
    const token = sess?.session?.access_token
    if (!token) { setLoading(false); return }
    const res = await fetch('/api/intelligence/plan', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const data = await res.json()
      setPlan(data.plan)
      setHasProfile(data.hasProfile)
      setNeedsRefresh(!!data.needsRefresh)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function refresh() {
    setRefreshing(true)
    try {
      const supabase = getSupabase()!
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')
      const res = await fetch('/api/intelligence/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Refresh failed')
      }
      showSuccess('Refreshed', 'Your content plan is up to date')
      await load()
    } catch (err) {
      showError('Error', err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) return null

  // First-time user: prompt to onboard
  if (!hasProfile) {
    return (
      <section style={{ marginTop: 40, padding: 24, border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-dim)', marginBottom: 6 }}>NEW</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, margin: '0 0 6px' }}>
              Get a 30-day <em>content plan</em> tuned to your niche
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', margin: 0, maxWidth: 500, lineHeight: 1.55 }}>
              Answer 3 questions. Our AI analyzes TikTok trends, Google searches, and Reddit conversations to build your calendar.
            </p>
          </div>
          <Link href="/onboarding/intelligence" style={{
            padding: '12px 22px', borderRadius: 11, whiteSpace: 'nowrap',
            background: 'var(--ink)', color: 'var(--on-ink)', border: 'none',
            fontSize: 13.5, fontWeight: 600, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            Start onboarding <ArrowUpRight size={14} />
          </Link>
        </div>
      </section>
    )
  }

  if (!plan) return null

  const upcoming = (plan.calendar_30d ?? []).slice(0, 6)

  return (
    <section style={{ marginTop: 40 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, margin: 0 }}>Your content <em>plan</em></h2>
        <button
          onClick={refresh}
          disabled={refreshing}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 9,
            background: 'var(--surface)', border: '1px solid var(--border)',
            color: 'var(--ink-2)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
          }}
        >
          {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
          Refresh trends
        </button>
      </div>

      {needsRefresh && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink-dim)', fontSize: 12.5, marginBottom: 14 }}>
          Trends are more than a week old — hit Refresh for the latest data.
        </div>
      )}

      {/* Top formats */}
      {(plan.top_formats?.length ?? 0) > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {plan.top_formats!.slice(0, 3).map(f => (
            <div key={f.format} style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 13, background: 'var(--surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', textTransform: 'capitalize' }}>
                  {f.format.replace(/_/g, ' ')}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-mute)' }}>{f.score}/100</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-dim)', lineHeight: 1.5 }}>{f.why}</div>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming calendar entries */}
      {upcoming.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 13, background: 'var(--surface)', overflow: 'hidden' }}>
          {upcoming.map((e, i) => (
            <div key={`${e.day}-${i}`} style={{
              display: 'grid', gridTemplateColumns: '54px 90px 1fr auto',
              alignItems: 'center', gap: 14,
              padding: '12px 16px',
              borderTop: i > 0 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-mute)' }}>D{e.day}</div>
              <div style={{
                fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                background: 'var(--surface-2)', color: 'var(--ink-2)',
                padding: '3px 8px', borderRadius: 5, textAlign: 'center',
              }}>{e.format.replace(/_/g, ' ')}</div>
              <div style={{ fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.hook}
              </div>
              <Link
                href={`/generate/ugc?hook=${encodeURIComponent(e.hook)}&format=${encodeURIComponent(e.format)}`}
                style={{
                  fontSize: 12, fontWeight: 600,
                  padding: '6px 12px', borderRadius: 8,
                  background: 'var(--ink)', color: 'var(--on-ink)',
                  textDecoration: 'none', whiteSpace: 'nowrap',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                Generate <ArrowUpRight size={12} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
