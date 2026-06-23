'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'

interface LibraryItem {
  id: string
  content_type: string
  storage_url: string
  metadata: { productName?: string; video?: string; image?: string } | null
  created_at: string
  status: string
}

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  if (secs < 172800) return 'yesterday'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function DashboardPage() {
  const [userName, setUserName] = useState('Creator')
  const [recentItems, setRecentItems] = useState<LibraryItem[]>([])
  const [recentLoading, setRecentLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return
    supabase.auth.getUser().then(({ data }: { data: { user: { user_metadata?: { full_name?: string }; email?: string } | null } }) => {
      const name = data.user?.user_metadata?.full_name || data.user?.email?.split('@')[0]
      if (name) setUserName(name)
    })
    supabase.auth.getSession().then(({ data }: { data: { session: { access_token?: string } | null } }) => {
      const token = data.session?.access_token
      if (!token) { setRecentLoading(false); return }
      fetch('/api/library', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : { items: [] })
        .then(({ items }) => setRecentItems((items || []).slice(0, 4)))
        .catch(() => {})
        .finally(() => setRecentLoading(false))
    })
  }, [])

  const today = new Date()
  const dayStr = today.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  const yearStr = today.getFullYear()
  const hours = today.getHours()
  const greeting = hours < 12 ? 'Good morning' : hours < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <main className="content">
      <div className="page-meta">
        {dayStr} · {dateStr} · {yearStr}
      </div>
      <h1 className="page-title">
        {greeting}, {userName.charAt(0).toUpperCase() + userName.slice(1)}.<br/>
        <span style={{ color: 'var(--ink-mute)' }}>What are we making <em>today?</em></span>
      </h1>
      <p className="page-sub">
        Turn one product photo into a scroll-stopping UGC ad. Pick a format, drop in your product, and let the pipeline do the filming.
      </p>

      {/* THREE-UP CARDS */}
      <div className="dash-grid">
        <Link href="/generate/ugc" className="dash-card">
          <div className="dash-art dash-art-video">
            <span className="dash-flag">FLAGSHIP</span>
            <video
              src="https://hqtlrfpzgrflbnkxxvhm.supabase.co/storage/v1/object/public/ugc-assets/demo/ugc-shopify.mp4"
              autoPlay muted loop playsInline
              className="dash-art-vid"
            />
            <div className="dash-art-overlay" />
          </div>
          <div className="dash-card-body">
            <div className="dash-card-head">
              <h3>UGC Package</h3>
              <ArrowUpRight />
            </div>
            <p>Full talking-head ad — script, character, voice, captions &amp; B-roll.</p>
          </div>
        </Link>

        <Link href="/generate/image" className="dash-card">
          <div className="dash-art dash-art-stripe">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '0.05em' }}>PRODUCT SHOT</span>
          </div>
          <div className="dash-card-body">
            <div className="dash-card-head">
              <h3>Image</h3>
              <ArrowUpRight />
            </div>
            <p>AI product photos &amp; creative imagery from a prompt.</p>
          </div>
        </Link>

        <Link href="/generate/video" className="dash-card">
          <div className="dash-art dash-art-video">
            <video
              src="https://hqtlrfpzgrflbnkxxvhm.supabase.co/storage/v1/object/public/ugc-assets/demo/video-pepsi.mp4"
              autoPlay muted loop playsInline
              className="dash-art-vid"
            />
            <div className="dash-art-overlay" />
          </div>
          <div className="dash-card-body">
            <div className="dash-card-head">
              <h3>Video</h3>
              <ArrowUpRight />
            </div>
            <p>Open-ended Sora 2 motion from any prompt.</p>
          </div>
        </Link>
      </div>

      {/* QUICK CHIPS */}
      <div className="dash-chips">
        {QUICK.map(q => (
          <Link key={q.label} href={q.href} className="dash-chip">{q.label}</Link>
        ))}
      </div>

      {/* RECENT */}
      <div className="section-head">
        <h2 className="section-title">Recent <em>generations</em></h2>
        <div className="section-actions">
          <Link href="/library">View library →</Link>
        </div>
      </div>

      <div className="dash-recent">
        {recentLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="dash-recent-item">
              <div className="dash-recent-thumb" style={{ opacity: 0.4 }} />
              <div className="dash-recent-meta">
                <div style={{ height: 12, width: '70%', background: 'var(--border)', borderRadius: 4, marginBottom: 6 }} />
                <div style={{ height: 10, width: '50%', background: 'var(--border)', borderRadius: 4 }} />
              </div>
            </div>
          ))
        ) : recentItems.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: 'var(--ink-mute)', fontSize: 13 }}>
            No content yet — <Link href="/generate/ugc" style={{ color: 'var(--accent)' }}>generate your first UGC video</Link>
          </div>
        ) : (
          recentItems.map(item => {
            const done = item.status === 'completed' || item.status === 'ready'
            const title = item.metadata?.productName || item.content_type || 'Untitled'
            const tag = item.content_type === 'ugc' ? 'UGC' : item.content_type?.toUpperCase() ?? '—'
            const dot = done ? '#2F7A4E' : item.status === 'failed' ? 'var(--bad)' : 'var(--ink-mute)'
            const statusLabel = done ? `Ready · ${timeAgo(item.created_at)}` : item.status === 'failed' ? 'Failed' : `Processing…`
            return (
              <div key={item.id} className="dash-recent-item">
                <div className="dash-recent-thumb" style={item.metadata?.video ? { backgroundImage: `url(${item.metadata.video})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                  <div className="dash-recent-play">
                    <div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--ink)"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  </div>
                  <span className="dash-recent-tag">{tag}</span>
                </div>
                <div className="dash-recent-meta">
                  <div className="dash-recent-title">{title}</div>
                  <div className="dash-recent-status">
                    <span className="dash-recent-dot" style={{ background: dot }} />
                    {statusLabel}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <style>{`
        .dash-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-top: 34px;
        }
        .dash-card {
          display: flex;
          flex-direction: column;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 17px;
          overflow: hidden;
          color: inherit;
          transition: box-shadow 160ms, transform 160ms;
        }
        .dash-card:hover {
          box-shadow: var(--shadow-lg);
          transform: translateY(-3px);
        }
        .dash-art {
          height: 158px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1px solid var(--border);
          overflow: hidden;
        }
        .dash-art-ugc { background: var(--surface-2); }
        .dash-art-stripe { background: repeating-linear-gradient(135deg, var(--surface-2) 0 10px, var(--surface-3) 10px 20px); }
        .dash-art-video { background: #111; }
        .dash-art-vid {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover;
        }
        .dash-art-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.28) 100%);
          pointer-events: none;
        }
        .dash-flag {
          position: absolute;
          top: 12px; left: 12px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.04em;
          background: var(--ink);
          color: #fff;
          border-radius: 6px;
          padding: 3px 8px;
        }
        .dash-strip {
          width: 54px;
          border-radius: 8px;
          background: repeating-linear-gradient(135deg, #E7E3DA 0 8px, #EFEBE2 8px 16px);
          border: 1px solid var(--border-strong);
        }
        .dash-strip-short { height: 96px; }
        .dash-strip-tall {
          height: 108px;
          background: repeating-linear-gradient(135deg, #E2DED4 0 8px, #ECE8DE 8px 16px);
          box-shadow: var(--shadow-md);
        }
        .dash-play {
          width: 46px; height: 46px; border-radius: 50%;
          background: var(--surface);
          border: 1px solid var(--border-strong);
          display: flex; align-items: center; justify-content: center;
          box-shadow: var(--shadow-md);
        }
        .dash-card-body { padding: 16px 17px 18px; }
        .dash-card-head {
          display: flex; align-items: center; justify-content: space-between;
        }
        .dash-card-head h3 {
          font-size: 16px;
          font-weight: 600;
          letter-spacing: -0.02em;
          margin: 0;
        }
        .dash-card-body p {
          font-size: 13px;
          color: var(--ink-dim);
          margin: 6px 0 0;
          line-height: 1.5;
        }
        .dash-chips {
          display: flex; gap: 10px; flex-wrap: wrap;
          margin-top: 16px;
        }
        .dash-chip {
          display: flex; align-items: center; gap: 8px;
          padding: 9px 15px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--surface);
          font-size: 13px;
          font-weight: 500;
          color: var(--ink-2);
          transition: background 120ms;
        }
        .dash-chip:hover { background: var(--hover); }

        .dash-recent {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
          margin-top: 20px;
        }
        .dash-recent-thumb {
          aspect-ratio: 0.5625;
          border-radius: 13px;
          border: 1px solid var(--border);
          background: repeating-linear-gradient(135deg, var(--surface-2) 0 9px, var(--surface-3) 9px 18px);
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: flex-end;
          padding: 10px;
          transition: box-shadow 160ms;
        }
        .dash-recent-thumb:hover { box-shadow: var(--shadow-lg); }
        .dash-recent-play {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .dash-recent-play > div {
          width: 38px; height: 38px; border-radius: 50%;
          background: rgba(255,255,255,0.92);
          display: flex; align-items: center; justify-content: center;
        }
        .dash-recent-tag {
          position: absolute; top: 9px; right: 9px;
          font-family: var(--font-mono);
          font-size: 10px;
          background: rgba(26,26,23,0.85);
          color: #fff;
          border-radius: 5px;
          padding: 2px 6px;
        }
        .dash-recent-meta { padding: 10px 2px 0; }
        .dash-recent-title {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: -0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dash-recent-status {
          display: flex; align-items: center; gap: 7px;
          margin-top: 5px;
          font-size: 11.5px;
          color: var(--ink-mute);
        }
        .dash-recent-dot {
          width: 6px; height: 6px; border-radius: 50%;
        }

        @media (max-width: 768px) {
          .dash-grid { grid-template-columns: 1fr; }
          .dash-recent { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

    </main>
  )
}

const QUICK = [
  { label: 'UGC Package', href: '/generate/ugc' },
  { label: 'Image', href: '/generate/image' },
  { label: 'Video', href: '/generate/video' },
  { label: 'Ask AI', href: '/ask' },
  { label: 'Library', href: '/library' },
]


function ArrowUpRight() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7M9 7h8v8"/>
    </svg>
  )
}
