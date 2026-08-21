'use client'

// Admin-only abuse-reports moderation queue. Lists incoming reports with
// filters, lets an admin mark each as reviewing / actioned / dismissed
// with optional notes. Gated by isAdminEmail on both the API and the page.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { isAdminEmail } from '@/lib/pov-access'

interface Report {
  id: string
  created_at: string
  reason: string
  description: string
  content_url: string | null
  content_id: string | null
  reporter_email: string | null
  reporter_ip: string | null
  status: 'new' | 'reviewing' | 'actioned' | 'dismissed'
  reviewed_at: string | null
  reviewed_by: string | null
  notes: string | null
}

const STATUS_META: Record<Report['status'], { label: string; color: string; bg: string }> = {
  new:        { label: 'New',        color: '#b45309', bg: '#fef3c7' },
  reviewing:  { label: 'Reviewing',  color: '#1e40af', bg: '#dbeafe' },
  actioned:   { label: 'Actioned',   color: '#166534', bg: '#dcfce7' },
  dismissed:  { label: 'Dismissed',  color: '#57534e', bg: '#f5f5f4' },
}

export default function AdminReportsPage() {
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | Report['status']>('new')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = getSupabase()
      if (!supabase) return
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) return
      const url = filter === 'all' ? '/api/admin/abuse-reports' : `/api/admin/abuse-reports?status=${filter}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setReports(data.reports ?? [])
    } catch (err) {
      console.error('[admin/reports] load failed:', err)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    (async () => {
      const supabase = getSupabase()
      if (!supabase) { setAllowed(false); return }
      const { data } = await supabase.auth.getSession()
      const email = data.session?.user?.email
      const ok = isAdminEmail(email)
      setAllowed(ok)
      if (!ok) { router.push('/dashboard'); return }
      await load()
    })()
  }, [load, router])

  async function updateStatus(id: string, status: Report['status']) {
    const supabase = getSupabase()
    if (!supabase) return
    const { data: sess } = await supabase.auth.getSession()
    const token = sess?.session?.access_token
    if (!token) return
    const res = await fetch('/api/admin/abuse-reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, status, notes: notesDraft[id] ?? null }),
    })
    if (!res.ok) {
      alert('Update failed')
      return
    }
    await load()
  }

  if (allowed === null) return null
  if (!allowed) return null

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px 80px', color: 'var(--ink)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 32, letterSpacing: '-0.01em', margin: 0 }}>Abuse reports</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-dim)', margin: '4px 0 0' }}>
            User-submitted reports from <Link href="/report" style={{ color: 'var(--ink)', textUnderlineOffset: 3 }}>/report</Link>. Review, action, or dismiss each within 24h.
          </p>
        </div>
        <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--ink-dim)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
          ← Dashboard
        </Link>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, padding: 4, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', width: 'fit-content' }}>
        {(['new', 'reviewing', 'actioned', 'dismissed', 'all'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.01em',
              background: filter === f ? 'var(--ink)' : 'transparent',
              color: filter === f ? 'var(--on-ink)' : 'var(--ink-dim)',
              transition: 'all 0.15s',
              textTransform: 'capitalize',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 14 }}>Loading…</div>
      ) : reports.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 14, background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)' }}>
          No reports in this queue.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reports.map(r => {
            const isExpanded = expandedId === r.id
            const meta = STATUS_META[r.status]
            return (
              <div key={r.id} style={{
                border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', padding: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                    padding: '3px 8px', borderRadius: 6,
                    background: meta.bg, color: meta.color,
                  }}>{meta.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{r.reason}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--ink-dim)', cursor: 'pointer', fontSize: 12 }}
                  >
                    {isExpanded ? 'Collapse' : 'Expand'}
                  </button>
                </div>

                <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: '0 0 8px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {isExpanded || r.description.length < 200 ? r.description : r.description.slice(0, 200) + '…'}
                </p>

                {(r.content_url || r.reporter_email) && (
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--ink-mute)', marginBottom: isExpanded ? 12 : 0 }}>
                    {r.content_url && (
                      <span>
                        <strong style={{ color: 'var(--ink-dim)' }}>Content:</strong>{' '}
                        <a href={r.content_url} target="_blank" rel="noreferrer" style={{ color: 'var(--ink)' }}>
                          {r.content_url.length > 60 ? r.content_url.slice(0, 60) + '…' : r.content_url}
                        </a>
                      </span>
                    )}
                    {r.reporter_email && (
                      <span><strong style={{ color: 'var(--ink-dim)' }}>Reporter:</strong> {r.reporter_email}</span>
                    )}
                  </div>
                )}

                {isExpanded && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 6 }}>
                      Internal notes
                    </label>
                    <textarea
                      value={notesDraft[r.id] ?? r.notes ?? ''}
                      onChange={e => setNotesDraft(prev => ({ ...prev, [r.id]: e.target.value }))}
                      rows={2}
                      placeholder="Optional — what you did / decided"
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        padding: '8px 10px', borderRadius: 8,
                        border: '1px solid var(--border)', background: 'var(--bg)',
                        color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit',
                        resize: 'vertical', minHeight: 60, outline: 'none',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      {(['reviewing', 'actioned', 'dismissed'] as const).map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => updateStatus(r.id, s)}
                          disabled={r.status === s}
                          style={{
                            padding: '7px 14px', borderRadius: 8,
                            border: `1px solid ${r.status === s ? 'var(--border)' : 'var(--ink)'}`,
                            background: r.status === s ? 'var(--surface-2)' : 'var(--ink)',
                            color: r.status === s ? 'var(--ink-mute)' : 'var(--on-ink)',
                            fontSize: 12, fontWeight: 600, cursor: r.status === s ? 'not-allowed' : 'pointer',
                            textTransform: 'capitalize',
                          }}
                        >
                          Mark {s}
                        </button>
                      ))}
                    </div>
                    {r.reviewed_at && (
                      <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>
                        Last review: {new Date(r.reviewed_at).toLocaleString()} by {r.reviewed_by ?? 'unknown'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
