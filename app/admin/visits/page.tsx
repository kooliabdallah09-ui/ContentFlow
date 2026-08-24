'use client'

// Admin visits panel. Mirrors the pc-ya reference layout: three stat cards
// on top (Recent visits / Unique IPs / Top IPs), a scannable table below.
// Reads /api/admin/visits which is guarded by isAdminEmail(). Non-admins
// hitting this page get bounced to /dashboard.

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { Loader2, RefreshCw } from 'lucide-react'

interface Visit {
  id: string
  created_at: string
  ip: string | null
  path: string
  referrer: string | null
  country: string | null
  city: string | null
  device: string | null
  browser: string | null
}
interface TopEntry { key: string; count: number }
interface Payload {
  visits: Visit[]
  totals: { visits: number; uniqueIps: number; uniquePaths: number; uniqueCountries: number }
  topIps: TopEntry[]
  topPaths: TopEntry[]
  topCountries: TopEntry[]
  windowHours: number
}

const WINDOWS: Array<{ label: string; hours: number }> = [
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
]

export default function AdminVisitsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<Payload | null>(null)
  const [hours, setHours] = useState(168)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Auth not ready')
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) { router.replace('/auth/login'); return }
      const res = await fetch(`/api/admin/visits?hours=${hours}&limit=500`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 403) { router.replace('/dashboard'); return }
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load visits')
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [hours, router])

  useEffect(() => { load() }, [load])

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 32px 80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-dim)', fontFamily: 'var(--font-mono, monospace)', marginBottom: 6 }}>
            Admin · Visits
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 32, lineHeight: 1.1, letterSpacing: '-0.01em', margin: 0 }}>
            Traffic
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {WINDOWS.map(w => (
            <button
              key={w.hours}
              onClick={() => setHours(w.hours)}
              style={{
                padding: '7px 14px', borderRadius: 8,
                border: `1px solid ${hours === w.hours ? 'var(--ink)' : 'var(--border)'}`,
                background: hours === w.hours ? 'var(--ink)' : 'var(--surface)',
                color: hours === w.hours ? 'var(--on-ink)' : 'var(--ink)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-mono, monospace)',
              }}
            >{w.label}</button>
          ))}
          <button onClick={load} title="Refresh" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid var(--danger)', color: 'var(--danger)', background: 'rgba(220,38,38,0.06)', marginBottom: 24, fontSize: 13.5 }}>
          {error}
        </div>
      )}

      {/* Stat cards */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 28 }}>
          <StatCard label="Recent visits" value={String(data.totals.visits)} />
          <StatCard label="Unique IPs" value={String(data.totals.uniqueIps)} />
          <TopCard label="Top IPs" entries={data.topIps} />
          <TopCard label="Top pages" entries={data.topPaths} />
          {data.topCountries.length > 0 && <TopCard label="Top countries" entries={data.topCountries} />}
        </div>
      )}

      {/* Visits table */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '140px 140px 1fr 1fr 1.5fr 160px',
          padding: '12px 18px', borderBottom: '1px solid var(--border)',
          fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-dim)',
          fontFamily: 'var(--font-mono, monospace)', fontWeight: 600,
        }}>
          <div>Date</div>
          <div>IP</div>
          <div>Location</div>
          <div>Referrer</div>
          <div>Page</div>
          <div style={{ textAlign: 'right' }}>Device</div>
        </div>
        {loading && !data ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-dim)', display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        ) : !data || data.visits.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-dim)' }}>
            No visits in the last {WINDOWS.find(w => w.hours === hours)?.label ?? 'window'}.
          </div>
        ) : (
          data.visits.map((v, i) => (
            <div key={v.id} style={{
              display: 'grid', gridTemplateColumns: '140px 140px 1fr 1fr 1.5fr 160px',
              padding: '12px 18px',
              borderBottom: i < data.visits.length - 1 ? '1px solid var(--border-soft, var(--border))' : 'none',
              fontSize: 13, alignItems: 'center', gap: 8,
            }}>
              <div style={{ color: 'var(--ink-dim)', fontFamily: 'var(--font-mono, monospace)', fontSize: 12.5 }}>{formatDate(v.created_at)}</div>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12.5 }}>{v.ip ?? '—'}</div>
              <div style={{ color: 'var(--ink-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {[v.city, v.country].filter(Boolean).join(', ') || '—'}
              </div>
              <div style={{ color: 'var(--ink-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5 }} title={v.referrer ?? undefined}>
                {v.referrer ? shortReferrer(v.referrer) : 'direct'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.path}>{v.path}</div>
              <div style={{ textAlign: 'right', color: 'var(--ink-dim)', fontSize: 12.5 }}>
                {[v.device, v.browser].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
          ))
        )}
      </div>

      <p style={{ marginTop: 20, fontSize: 12, color: 'var(--ink-dim)', lineHeight: 1.6 }}>
        /admin and /api pages are not tracked. Compare your public IP (via a &quot;what is my ip&quot; search)
        against the entries above to filter out your own visits.
      </p>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '18px 20px', border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)' }}>
      <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-dim)', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 42, lineHeight: 1, fontWeight: 400 }}>{value}</div>
    </div>
  )
}

function TopCard({ label, entries }: { label: string; entries: TopEntry[] }) {
  return (
    <div style={{ padding: '18px 20px', border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)' }}>
      <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-dim)', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, marginBottom: 10 }}>{label}</div>
      {entries.length === 0 ? (
        <div style={{ color: 'var(--ink-dim)', fontSize: 13 }}>—</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.slice(0, 5).map(e => (
            <div key={e.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, fontFamily: 'var(--font-mono, monospace)' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.key}>{e.key}</span>
              <span style={{ color: 'var(--ink-dim)' }}>{e.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }
  if (!sameYear) opts.year = 'numeric'
  return d.toLocaleString('en-US', opts)
}

function shortReferrer(ref: string): string {
  try {
    const u = new URL(ref)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return ref.length > 40 ? ref.slice(0, 40) + '…' : ref
  }
}
