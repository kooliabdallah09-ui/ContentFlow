'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'

interface AnalyticsData {
  totalGenerated: number
  totalCreditsUsed: number
  generationsByType: Record<string, number>
  creditsByType: Record<string, number>
  recentActivity: Array<{ type: string; date: string; credits: number }>
}

interface CreditsData {
  balance: number
  plan: string
  monthlyCredits: number
  resetDate: string
}

const TYPE_LABELS: Record<string, string> = {
  ugc: 'UGC Video',
  video: 'AI Video',
  image: 'Image',
  social: 'Social / Caption',
  voice: 'Voice',
  'screen-demo': 'Screen Demo',
  carousel: 'Carousel',
}

const TYPE_COLORS: Record<string, string> = {
  ugc: '#7C6CF8',
  video: '#E85D4A',
  image: '#3B82F6',
  social: '#10B981',
  voice: '#F59E0B',
  'screen-demo': '#EC4899',
  carousel: '#8B5CF6',
}

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  if (secs < 172800) return 'yesterday'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [credits, setCredits] = useState<CreditsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = getSupabase()
      if (!supabase) { setLoading(false); return }
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) { setLoading(false); return }

      const [analyticsRes, creditsRes] = await Promise.allSettled([
        fetch('/api/analytics', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/credits/balance', { headers: { Authorization: `Bearer ${token}` } }),
      ])

      if (analyticsRes.status === 'fulfilled' && analyticsRes.value.ok) {
        setData(await analyticsRes.value.json())
      }
      if (creditsRes.status === 'fulfilled' && creditsRes.value.ok) {
        setCredits(await creditsRes.value.json())
      }
      setLoading(false)
    }
    load()
  }, [])

  const typeEntries = data
    ? Object.entries(data.generationsByType).sort((a, b) => b[1] - a[1])
    : []
  const maxCount = typeEntries[0]?.[1] ?? 1

  const thisMonth = new Date()
  thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0)
  const thisMonthCount = data?.recentActivity.filter(a => new Date(a.date) >= thisMonth).length ?? 0

  return (
    <main className="content">
      <div className="page-meta">Analytics</div>
      <h1 className="page-title">Your Content Stats</h1>
      <p className="page-sub">Everything you&apos;ve created with ContentFlow.</p>

      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 14 }}>
          Loading…
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 32 }}>
            {[
              { label: 'Total created', value: data?.totalGenerated ?? 0, sub: 'all time' },
              { label: 'This month', value: thisMonthCount, sub: new Date().toLocaleDateString('en-US', { month: 'long' }) },
              { label: 'Credits used', value: data?.totalCreditsUsed ?? 0, sub: 'all time' },
              { label: 'Credits left', value: credits?.balance ?? '—', sub: `of ${credits?.monthlyCredits ?? '?'}/mo` },
            ].map(kpi => (
              <div key={kpi.label} style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '18px 20px',
              }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  {kpi.label}
                </div>
                <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {kpi.value}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 5 }}>{kpi.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
            {/* Content by type */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 18 }}>Content by type</div>
              {typeEntries.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--ink-mute)', padding: '20px 0' }}>No content yet — start generating!</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {typeEntries.map(([type, count]) => (
                    <div key={type}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)' }}>{TYPE_LABELS[type] ?? type}</span>
                        <span style={{ fontSize: 12, color: 'var(--ink-mute)', fontWeight: 600 }}>{count}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 6, background: 'var(--surface-3)' }}>
                        <div style={{
                          height: '100%', borderRadius: 6,
                          width: `${(count / maxCount) * 100}%`,
                          background: TYPE_COLORS[type] ?? '#6B7280',
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Credits by type */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 18 }}>Credits spent by type</div>
              {Object.keys(data?.creditsByType ?? {}).length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--ink-mute)', padding: '20px 0' }}>No data yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {Object.entries(data?.creditsByType ?? {}).sort((a, b) => b[1] - a[1]).map(([type, cr]) => {
                    const maxCr = Math.max(...Object.values(data?.creditsByType ?? { _: 1 }))
                    return (
                      <div key={type}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)' }}>{TYPE_LABELS[type] ?? type}</span>
                          <span style={{ fontSize: 12, color: 'var(--ink-mute)', fontWeight: 600 }}>{cr} cr</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 6, background: 'var(--surface-3)' }}>
                          <div style={{
                            height: '100%', borderRadius: 6,
                            width: `${(cr / maxCr) * 100}%`,
                            background: TYPE_COLORS[type] ?? '#6B7280',
                            transition: 'width 0.4s ease',
                          }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent activity */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px', marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>Recent activity</div>
            {(data?.recentActivity ?? []).length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ink-mute)', padding: '12px 0' }}>Nothing yet — go make something!</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {(data?.recentActivity ?? []).slice(0, 15).map((item, i, arr) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--border-soft)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLORS[item.type] ?? '#6B7280', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)' }}>{TYPE_LABELS[item.type] ?? item.type}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{item.credits} cr</span>
                      <span style={{ fontSize: 12, color: 'var(--ink-mute)', minWidth: 60, textAlign: 'right' }}>{timeAgo(item.date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Social analytics placeholder */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
            padding: '22px', marginTop: 20, display: 'flex', alignItems: 'center', gap: 18,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: 'var(--surface-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.6">
                <path d="M18 20V10M12 20V4M6 20v-6"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>Social performance analytics</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-mute)', lineHeight: 1.5 }}>
                Views, engagement, reach, and conversions from Instagram, TikTok &amp; YouTube — coming once your integrations are live.
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
