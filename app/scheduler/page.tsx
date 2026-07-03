'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'

interface QueueJob {
  id: string
  title: string
  scheduled_at: string
  status: 'queued' | 'uploading' | 'published' | 'failed'
  yt_video_url?: string
  calendar_date?: string
  video_url?: string
  privacy?: string
  error_message?: string
}

const STATUS_COLORS: Record<string, string> = {
  queued: '#F59E0B',
  uploading: '#3B82F6',
  published: '#10B981',
  failed: '#EF4444',
}

const STATUS_LABELS: Record<string, string> = {
  queued: 'Scheduled',
  uploading: 'Uploading',
  published: 'Published',
  failed: 'Failed',
}

function YTIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )
}

function IGIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <radialGradient id="ig-g" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497"/>
          <stop offset="5%" stopColor="#fdf497"/>
          <stop offset="45%" stopColor="#fd5949"/>
          <stop offset="60%" stopColor="#d6249f"/>
          <stop offset="90%" stopColor="#285AEB"/>
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig-g)"/>
      <rect x="2.2" y="2.2" width="19.6" height="19.6" rx="5" stroke="#fff" strokeWidth="1.5"/>
      <circle cx="12" cy="12" r="4.5" stroke="#fff" strokeWidth="1.5"/>
      <circle cx="17.5" cy="6.5" r="1.2" fill="#fff"/>
    </svg>
  )
}

function TKIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect width="24" height="24" rx="6" fill="#010101"/>
      <path d="M16.5 8.5a4 4 0 01-3.5-3.5V4h-2.5v11a2 2 0 11-2-2c.18 0 .35.02.5.06V10.5a4.5 4.5 0 104.5 4.5V9.1a6.5 6.5 0 003.5 1V7.6a4 4 0 01-0.5-.1z" fill="white"/>
    </svg>
  )
}

function FBIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect width="24" height="24" rx="6" fill="#1877F2"/>
      <path d="M16.5 12H14v-1.5c0-.69.31-1 1-1h1.5V7H14c-2.21 0-3 1.5-3 3v2H9v2.5h2V22h3v-7.5h2l.5-2.5z" fill="#fff"/>
    </svg>
  )
}

function CalIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="3"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>
  )
}

function formatScheduled(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function SchedulerPage() {
  const [jobs, setJobs] = useState<QueueJob[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'queued' | 'published' | 'failed'>('all')

  async function loadJobs() {
    const supabase = getSupabase()
    if (!supabase) { setLoading(false); return }
    const { data: sess } = await supabase.auth.getSession()
    const token = sess?.session?.access_token
    if (!token) { setLoading(false); return }
    const res = await fetch('/api/youtube/queue', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const { jobs: j } = await res.json()
      setJobs(j ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { loadJobs() }, [])

  async function cancelJob(id: string) {
    const supabase = getSupabase()
    if (!supabase) return
    const { data: sess } = await supabase.auth.getSession()
    const token = sess?.session?.access_token
    if (!token) return
    setCancelling(id)
    await fetch(`/api/youtube/queue?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    setJobs(prev => prev.filter(j => j.id !== id))
    setCancelling(null)
  }

  const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter)
  const counts = {
    all: jobs.length,
    queued: jobs.filter(j => j.status === 'queued').length,
    published: jobs.filter(j => j.status === 'published').length,
    failed: jobs.filter(j => j.status === 'failed').length,
  }

  return (
    <main className="content">
      <div className="page-meta">Scheduler</div>
      <h1 className="page-title">Post Scheduler</h1>
      <p className="page-sub">
        Auto-publish content to YouTube at scheduled times. More platforms coming soon.
      </p>

      {/* Platform tabs */}
      <div style={{ display: 'flex', gap: 10, marginTop: 28, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', borderRadius: 10,
          background: '#FF0000', color: '#fff',
          fontSize: 13, fontWeight: 600,
        }}>
          <YTIcon size={14} /> YouTube
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 500, color: 'var(--ink-mute)' }}>
          <IGIcon size={16} /> Instagram
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-faint)', background: 'var(--surface-3)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.04em' }}>SOON</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 500, color: 'var(--ink-mute)' }}>
          <TKIcon size={16} /> TikTok
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-faint)', background: 'var(--surface-3)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.04em' }}>SOON</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 500, color: 'var(--ink-mute)' }}>
          <FBIcon size={16} /> Facebook
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-faint)', background: 'var(--surface-3)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.04em' }}>SOON</span>
        </div>
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 8, marginTop: 20, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        {(['all', 'queued', 'published', 'failed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 12.5, fontWeight: 600,
            background: filter === f ? 'var(--ink)' : 'transparent',
            color: filter === f ? 'var(--on-ink)' : 'var(--ink-mute)',
            transition: 'all 0.12s',
          }}>
            {f === 'all' ? 'All' : STATUS_LABELS[f]} {counts[f] > 0 && <span style={{ opacity: 0.6, fontWeight: 400 }}>({counts[f]})</span>}
          </button>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <Link href="/calendar" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)',
            padding: '6px 14px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--surface)',
            textDecoration: 'none',
          }}>
            Schedule from Calendar →
          </Link>
        </div>
      </div>

      {/* Jobs list */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 14 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{
          marginTop: 40, padding: '48px 24px', textAlign: 'center',
          background: 'var(--surface)', border: '1px dashed var(--border)',
          borderRadius: 16,
        }}>
          <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}><CalIcon size={36} /></div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
            {filter === 'all' ? 'No scheduled posts yet' : `No ${STATUS_LABELS[filter].toLowerCase()} posts`}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginBottom: 20, lineHeight: 1.6 }}>
            Go to the calendar, pick a day, and click &ldquo;Schedule to YouTube&rdquo;.
          </div>
          <Link href="/calendar" style={{
            display: 'inline-flex', padding: '10px 20px', borderRadius: 10,
            background: 'var(--ink)', color: 'var(--on-ink)',
            fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}>
            Open Calendar
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          {filtered.map(job => (
            <div key={job.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              {/* Platform icon */}
              <div style={{
                width: 38, height: 38, borderRadius: 9,
                background: '#FF0000', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <YTIcon size={16} />
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {job.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
                  {formatScheduled(job.scheduled_at)}
                  {job.privacy && <span style={{ marginLeft: 10, opacity: 0.6 }}>{job.privacy}</span>}
                </div>
                {job.error_message && (
                  <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 3 }}>{job.error_message}</div>
                )}
              </div>

              {/* Status badge */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 7,
                background: `${STATUS_COLORS[job.status]}18`,
                flexShrink: 0,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLORS[job.status] }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLORS[job.status] }}>
                  {STATUS_LABELS[job.status]}
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {job.yt_video_url && (
                  <a href={job.yt_video_url} target="_blank" rel="noopener noreferrer" style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: 'var(--surface-2)', color: 'var(--ink-2)',
                    border: '1px solid var(--border)', textDecoration: 'none',
                  }}>View ↗</a>
                )}
                {job.status === 'queued' && (
                  <button onClick={() => cancelJob(job.id)} disabled={cancelling === job.id} style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: 'var(--surface-2)', color: 'var(--ink-mute)',
                    border: '1px solid var(--border)', cursor: 'pointer',
                    opacity: cancelling === job.id ? 0.5 : 1,
                  }}>
                    {cancelling === job.id ? '…' : 'Cancel'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Coming soon: other platforms */}
      <div style={{
        marginTop: 32,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '20px 22px',
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
      }}>
        {[
          { name: 'Instagram', icon: <IGIcon size={22} />, desc: 'Reels & feed posts with caption and hashtags' },
          { name: 'TikTok', icon: <TKIcon size={22} />, desc: 'Short videos with title and privacy controls' },
          { name: 'Facebook', icon: <FBIcon size={22} />, desc: 'Page posts with image or video attachments' },
        ].map(p => (
          <div key={p.name} style={{ padding: '16px', background: 'var(--surface-2)', borderRadius: 11, border: '1px solid var(--border-soft)' }}>
            <div style={{ marginBottom: 10 }}>{p.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{p.name}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.5 }}>{p.desc}</div>
            <div style={{ marginTop: 10, fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', letterSpacing: '0.05em' }}>COMING SOON</div>
          </div>
        ))}
      </div>
    </main>
  )
}
