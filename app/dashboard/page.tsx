'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'

// Editorial dashboard from the Claude Design export.
// Greeting eyebrow + serif heading. Three-up generator cards. Quick chips. Recent grid.

export default function DashboardPage() {
  const [userName, setUserName] = useState('Creator')

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return
    supabase.auth.getUser().then(({ data }: { data: { user: { user_metadata?: { full_name?: string }; email?: string } | null } }) => {
      const name = data.user?.user_metadata?.full_name || data.user?.email?.split('@')[0]
      if (name) setUserName(name)
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
          <div className="dash-art dash-art-ugc">
            <span className="dash-flag">FLAGSHIP</span>
            <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
              <div className="dash-strip dash-strip-short" />
              <div className="dash-strip dash-strip-tall" />
              <div className="dash-strip dash-strip-short" />
            </div>
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
          <div className="dash-art dash-art-stripe">
            <div className="dash-play">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--ink)"><path d="M8 5v14l11-7z"/></svg>
            </div>
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
        {RECENT.map(r => (
          <div key={r.id} className="dash-recent-item">
            <div className="dash-recent-thumb">
              <div className="dash-recent-play">
                <div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--ink)"><path d="M8 5v14l11-7z"/></svg>
                </div>
              </div>
              <span className="dash-recent-tag">{r.tag}</span>
            </div>
            <div className="dash-recent-meta">
              <div className="dash-recent-title">{r.title}</div>
              <div className="dash-recent-status">
                <span className="dash-recent-dot" style={{ background: r.dot }} />
                {r.status}
              </div>
            </div>
          </div>
        ))}
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

const RECENT = [
  { id: '1', title: 'Sunset Social — tea hook', tag: '8s', dot: '#2F7A4E', status: 'Ready · 2 min ago' },
  { id: '2', title: 'Glow serum — usage shot', tag: '12s', dot: '#2F7A4E', status: 'Ready · 14 min ago' },
  { id: '3', title: 'Roast & Brew — pour', tag: '4s', dot: 'var(--ink-mute)', status: 'Rendering · ~40s left' },
  { id: '4', title: 'Sleep gummies — hook 2', tag: '12s', dot: '#2F7A4E', status: 'Ready · yesterday' },
]

function ArrowUpRight() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7M9 7h8v8"/>
    </svg>
  )
}
